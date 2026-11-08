import * as fs from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import * as vscode from 'vscode';

import { actionTitle, BuildAction, classifyExitCode, uv4Command } from '../core/command';
import { buildSummary, flashSummary } from '../core/buildlog';
import { parseBuildOutput } from '../core/diagnostics';
import {
    configKey,
    configNamesFor,
    CppConfiguration,
    CppPropertiesFormatError,
    TargetRef,
    updateCppProperties
} from '../core/cppconfig';
import { parseDependencyFile } from '../core/deps';
import {
    findTarget,
    ProjectNode,
    SourceNode,
    sourceKindOf,
    TargetNode,
    ToolchainId,
    withDependencies
} from '../core/model';
import { parseProject, resolveProjectPath, uniquePaths } from '../core/parser';
import { ArtifactPaths, cppPropertiesFileFor } from './artifacts';
import { readSettings, Settings, uv4PathFor, uv4SettingKey } from './config';
import { appendLine, Logger } from './logger';
import { runUv4 } from './runner';
import { BuildStatus } from './status';
import { resolverFor, preloadArmclangMacros } from './toolchain';
import { discoverProjects, resolveProjectRoot } from './workspace';

export interface LoadedProject {
    readonly project: ProjectNode;
    readonly workspaceRoot: string;
    readonly artifacts: ArtifactPaths;
    readonly activeTarget: string | undefined;
}

/**
 * Owns the loaded projects: their model, their file watcher and their build
 * state. The tree view is a pure rendering of whatever this store exposes.
 */
export class ProjectStore implements vscode.Disposable {
    private readonly entries = new Map<string, Entry>();
    private readonly emitter = new vscode.EventEmitter<void>();
    private readonly subscriptions: vscode.Disposable[] = [];
    private readonly diagnostics = vscode.languages.createDiagnosticCollection('keil-assistant');
    private readonly diagnosticFiles = new Map<string, vscode.Uri[]>();
    private readonly status = new BuildStatus('keil-assistant.showOutput');
    private settings: Settings;
    private activeProjectId: string | undefined;
    private warnedAboutFallback = false;

    readonly onDidChange: vscode.Event<void> = this.emitter.event;

    constructor(private readonly logger: Logger) {
        this.settings = readSettings();
        this.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration('KeilAssistant')) {
                    void this.reloadAll();
                }
            })
        );
    }

    list(): LoadedProject[] {
        return [...this.entries.values()].map((entry) => this.toLoadedProject(entry));
    }

    getActiveProject(): LoadedProject | undefined {
        const entry = this.activeProjectId === undefined ? undefined : this.entries.get(this.activeProjectId);
        return entry === undefined ? undefined : this.toLoadedProject(entry);
    }

    /** Loads every project that belongs to the workspace; errors end up in the log. */
    async restore(): Promise<void> {
        for (const projectFile of await discoverProjects(this.settings)) {
            try {
                await this.open(projectFile);
            } catch (error) {
                this.logger.error(undefined, `cannot open ${basename(projectFile)}: ${messageOf(error)}`);
            }
        }
    }

    async open(projectPath: string): Promise<LoadedProject> {
        const existing = [...this.entries.values()].find(
            (entry) => entry.project.path.toLowerCase() === projectPath.toLowerCase()
        );
        if (existing !== undefined) {
            return this.toLoadedProject(existing);
        }

        const location = resolveProjectRoot(projectPath);
        if (location.fallback && !this.warnedAboutFallback) {
            this.warnedAboutFallback = true;
            void vscode.window.showWarningMessage(
                'Keil Assistant keeps its files in the workspace folder, but no folder is open, ' +
                    'so they are written next to the project for now.'
            );
        }

        const project = await this.loadProject(projectPath);
        const entry = new Entry(project, location.root, new ArtifactPaths(location.root, project.id));
        try {
            entry.artifacts.ensureStateDirectory();
        } catch (error) {
            this.logger.warning(undefined, `cannot create ${entry.artifacts.stateDirectory}: ${messageOf(error)}`);
        }

        entry.activeTarget = project.targets[0]?.name;
        this.entries.set(project.id, entry);
        this.watch(entry);
        this.activeProjectId ??= project.id;
        this.refreshDependencies(entry);

        this.logger.info(
            entry.artifacts.logFile,
            `opened ${project.path} (${project.toolchain}, ${project.targets.length} target(s))`
        );

        this.syncCppProperties();
        this.notify();
        return this.toLoadedProject(entry);
    }

    close(id: string): void {
        const entry = this.entries.get(id);
        if (entry === undefined) {
            return;
        }
        entry.dispose();
        this.entries.delete(id);
        if (this.activeProjectId === id) {
            this.activeProjectId = this.entries.keys().next().value;
        }
        this.syncCppProperties();
        this.notify();
    }

    activate(id: string): void {
        if (this.entries.has(id)) {
            this.activeProjectId = id;
            this.notify();
        }
    }

    async switchTarget(id: string): Promise<void> {
        const entry = this.entries.get(id);
        if (entry === undefined) {
            return;
        }
        const picked = await vscode.window.showQuickPick(
            entry.project.targets.map((target) => target.name),
            { placeHolder: 'Select the uVision target to work on' }
        );
        if (picked !== undefined) {
            entry.activeTarget = picked;
            this.notify();
        }
    }

    async build(id: string, targetName: string | undefined, action: BuildAction): Promise<void> {
        const entry = this.entries.get(id);
        const target = entry === undefined ? undefined : findTarget(entry.project, targetName ?? entry.activeTarget);
        if (entry === undefined || target === undefined) {
            void vscode.window.showWarningMessage('The project is no longer loaded.');
            return;
        }
        if (entry.building) {
            void vscode.window.showInformationMessage(`A build is already running for "${entry.project.name}".`);
            return;
        }

        const uv4Path = uv4PathFor(entry.project.toolchain, this.settings);
        if (uv4Path === undefined) {
            await this.promptForUv4Path(entry.project.toolchain);
            return;
        }
        if (!fs.existsSync(uv4Path)) {
            const choice = await vscode.window.showErrorMessage(`UV4.exe was not found: ${uv4Path}`, 'Open Settings');
            if (choice === 'Open Settings') {
                await this.openSetting(uv4SettingKey(entry.project.toolchain));
            }
            return;
        }

        entry.building = true;
        const command = uv4Command(
            action,
            uv4Path,
            entry.project.path,
            target.name,
            entry.artifacts.buildLogFile
        );
        const label = `${actionTitle(action)} ${entry.project.name}`;
        this.logger.info(
            entry.artifacts.logFile,
            `${actionTitle(action)} "${target.name}": ${command.executable} ${command.args.join(' ')}`
        );
        this.logger.raw('');
        this.logger.raw(`──── ${actionTitle(action)} "${target.name}" · ${clock()} ────`);
        this.status.start(label);

        try {
            entry.artifacts.ensureStateDirectory();
            const started = Date.now();
            const exitCode = await runUv4({
                command,
                outputLog: entry.artifacts.buildLogFile,
                onOutput: (chunk) => this.logger.stream(chunk)
            });
            const seconds = ((Date.now() - started) / 1000).toFixed(1);

            const result = classifyExitCode(exitCode);
            const output = readText(entry.artifacts.buildLogFile);

            this.publishDiagnostics(entry, output);

            const footer =
                result.outcome === 'failure'
                    ? `failed — ${result.detail}`
                    : result.outcome === 'warnings'
                      ? 'finished with warnings'
                      : 'finished';
            this.logger.raw(`──── ${footer} · ${seconds}s ────`);
            this.status.finish(
                result.outcome === 'failure' ? 'failure' : result.outcome === 'warnings' ? 'warnings' : 'ok',
                label
            );

            if (result.outcome === 'failure') {
                this.logger.error(
                    entry.artifacts.logFile,
                    `${actionTitle(action)} failed: ${result.detail}`
                );
                await this.reportFailure(entry, action, result.detail, buildSummary(output));
                return;
            }

            this.logger.info(
                entry.artifacts.logFile,
                `${actionTitle(action)} finished: ${result.detail} (exit code ${exitCode})`
            );
            const flash = action === 'download' ? flashSummary(output) : undefined;
            if (flash !== undefined) {
                void vscode.window.showInformationMessage(`Download finished: ${flash}`);
            } else if (result.outcome === 'warnings') {
                void vscode.window.showWarningMessage(
                    `${actionTitle(action)} finished with warnings. See the Problems panel or the output channel.`
                );
            }

            this.refreshDependencies(entry);
            this.notify();
        } catch (error) {
            this.logger.error(entry.artifacts.logFile, `cannot run UV4.exe: ${messageOf(error)}`);
            void vscode.window.showErrorMessage(`Cannot run UV4.exe: ${messageOf(error)}`);
        } finally {
            entry.building = false;
        }
    }

    async openLog(id: string): Promise<void> {
        const entry = this.entries.get(id);
        if (entry === undefined) {
            return;
        }
        try {
            entry.artifacts.ensureStateDirectory();
            // The `-o` log holds the compiler messages, the other one records
            // what the extension did; show the more useful one.
            const file = fs.existsSync(entry.artifacts.buildLogFile)
                ? entry.artifacts.buildLogFile
                : entry.artifacts.logFile;
            if (!fs.existsSync(file)) {
                appendLine(file, '# Keil Assistant log');
            }
            await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
        } catch (error) {
            void vscode.window.showErrorMessage(`Cannot open the log: ${messageOf(error)}`);
        }
    }

    dispose(): void {
        for (const entry of this.entries.values()) {
            entry.dispose();
        }
        this.entries.clear();
        this.diagnostics.clear();
        this.diagnostics.dispose();
        this.status.dispose();
        for (const subscription of this.subscriptions) {
            subscription.dispose();
        }
        this.emitter.dispose();
    }

    private async reloadAll(): Promise<void> {
        this.settings = readSettings();
        for (const entry of this.entries.values()) {
            try {
                entry.project = await this.loadProject(entry.project.path);
                entry.activeTarget = selectedTarget(entry.project, entry.activeTarget);
                this.refreshDependencies(entry);
            } catch (error) {
                this.logger.error(entry.artifacts.logFile, `reload failed: ${messageOf(error)}`);
            }
        }
        this.syncCppProperties();
        this.notify();
    }

    private async reload(entry: Entry): Promise<void> {
        try {
            entry.project = await this.loadProject(entry.project.path);
            entry.activeTarget = selectedTarget(entry.project, entry.activeTarget);
            this.refreshDependencies(entry);
            this.syncCppProperties();
            this.notify();
        } catch (error) {
            if (isFileLocked(error)) {
                // uVision holds a lock on its own project file while saving.
                entry.schedule(() => void this.reload(entry), 500);
                return;
            }
            this.logger.error(entry.artifacts.logFile, `reload failed: ${messageOf(error)}`);
        }
    }

    private async loadProject(projectPath: string): Promise<ProjectNode> {
        await preloadArmclangMacros(this.settings);
        const content = await fs.promises.readFile(projectPath, 'utf8');
        const toolchain: ToolchainId = projectPath.toLowerCase().endsWith('.uvproj') ? 'C51' : 'ARM';
        return parseProject(content.replace(/^\uFEFF/, ''), {
            filePath: projectPath,
            toolchain: resolverFor(toolchain, this.settings),
            fileExists: (path) => fs.existsSync(path)
        });
    }

    private watch(entry: Entry): void {
        entry.watch(
            () => entry.schedule(() => void this.reload(entry)),
            (error) => this.logger.warning(entry.artifacts.logFile, `file watcher: ${error.message}`)
        );
    }

    /**
     * `c_cpp_properties.json` is one file per workspace folder, so all projects
     * that share a folder are written together; that also resolves the target
     * name collisions between projects.
     */
    private syncCppProperties(): void {
        const byWorkspaceRoot = new Map<string, Entry[]>();
        for (const entry of this.entries.values()) {
            const entries = byWorkspaceRoot.get(entry.workspaceRoot) ?? [];
            entries.push(entry);
            byWorkspaceRoot.set(entry.workspaceRoot, entries);
        }

        for (const [workspaceRoot, entries] of byWorkspaceRoot) {
            const targets: TargetRef[] = [];
            for (const entry of entries) {
                for (const target of entry.project.targets) {
                    targets.push({
                        projectId: entry.project.id,
                        projectName: entry.project.name,
                        targetName: target.name
                    });
                }
            }

            const names = configNamesFor(targets);
            const configurations: CppConfiguration[] = [];
            for (const entry of entries) {
                for (const target of entry.project.targets) {
                    const name = names.get(configKey(entry.project.id, target.name));
                    if (name !== undefined) {
                        configurations.push({
                            name,
                            includePath: target.includes,
                            defines: target.defines
                        });
                    }
                }
            }

            this.writeCppProperties(workspaceRoot, configurations);
        }
    }

    private writeCppProperties(workspaceRoot: string, configurations: readonly CppConfiguration[]): void {
        const file = cppPropertiesFileFor(workspaceRoot);
        let existing: string | undefined;
        try {
            existing = fs.readFileSync(file, 'utf8');
        } catch {
            existing = undefined;
        }

        try {
            const updated = updateCppProperties(existing, configurations);
            if (updated !== existing) {
                fs.mkdirSync(dirname(file), { recursive: true });
                fs.writeFileSync(file, updated, 'utf8');
            }
        } catch (error) {
            if (!(error instanceof CppPropertiesFormatError)) {
                this.logger.error(undefined, `cannot write ${file}: ${messageOf(error)}`);
                return;
            }
            this.backupCppProperties(file);
            try {
                fs.writeFileSync(file, updateCppProperties(undefined, configurations), 'utf8');
                void vscode.window.showWarningMessage(
                    `${basename(file)} was not valid JSON. It has been backed up as ${basename(file)}.bak and regenerated.`
                );
            } catch (writeError) {
                this.logger.error(undefined, `cannot write ${file}: ${messageOf(writeError)}`);
            }
        }
    }

    /** Never overwrite an existing backup: the first one is the useful one. */
    private backupCppProperties(file: string): void {
        try {
            const backup = `${file}.bak`;
            if (!fs.existsSync(backup)) {
                fs.copyFileSync(file, backup);
            }
        } catch {
            // best effort
        }
    }

    /** Reference lists come from the `.d` files the ARM compilers leave behind. */
    private refreshDependencies(entry: Entry): void {
        if (entry.project.toolchain !== 'ARM') {
            return;
        }
        const projectDirectory = entry.project.dir;
        entry.project = withDependencies(entry.project, (target, source) =>
            readDependencies(projectDirectory, target, source)
        );
    }

    private async reportFailure(
        entry: Entry,
        action: BuildAction,
        detail: string,
        summary: string | undefined
    ): Promise<void> {
        const text =
            summary === undefined
                ? `${actionTitle(action)} failed: ${detail}.`
                : `${actionTitle(action)} failed: ${detail} (${summary}).`;
        const choice = await vscode.window.showErrorMessage(text, 'Show Log');
        if (choice === 'Show Log') {
            await this.openLog(entry.project.id);
        }
    }

    /**
     * `UV4.exe` never writes to the console, so the compiler messages come from
     * the `-o` log and are turned into real Problems panel entries here.
     */
    private publishDiagnostics(entry: Entry, output: string): void {
        for (const uri of this.diagnosticFiles.get(entry.project.id) ?? []) {
            this.diagnostics.delete(uri);
        }
        this.diagnosticFiles.delete(entry.project.id);

        if (output.trim() === '') {
            return;
        }

        const byFile = new Map<string, vscode.Diagnostic[]>();
        for (const item of parseBuildOutput(output)) {
            const file = resolveProjectPath(entry.project.dir, item.file);
            const line = Math.max(item.line - 1, 0);
            const column = Math.max((item.column ?? 1) - 1, 0);
            const range = new vscode.Range(line, column, line, 500);
            const severity =
                item.severity === 'warning'
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Error;
            const diagnostic = new vscode.Diagnostic(range, item.message, severity);
            diagnostic.source = 'keil';
            byFile.set(file, [...(byFile.get(file) ?? []), diagnostic]);
        }

        const uris: vscode.Uri[] = [];
        for (const [file, diagnostics] of byFile) {
            const uri = vscode.Uri.file(file);
            this.diagnostics.set(uri, diagnostics);
            uris.push(uri);
        }
        this.diagnosticFiles.set(entry.project.id, uris);
    }

    private async promptForUv4Path(toolchain: ToolchainId): Promise<void> {
        const key = uv4SettingKey(toolchain);
        const choice = await vscode.window.showErrorMessage(
            `Set "${key}" to the absolute path of UV4.exe before building.`,
            'Open Settings'
        );
        if (choice === 'Open Settings') {
            await this.openSetting(key);
        }
    }

    private async openSetting(key: string): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', key);
    }

    private notify(): void {
        this.emitter.fire();
    }

    private toLoadedProject(entry: Entry): LoadedProject {
        return {
            project: entry.project,
            workspaceRoot: entry.workspaceRoot,
            artifacts: entry.artifacts,
            activeTarget: entry.activeTarget
        };
    }
}

class Entry {
    project: ProjectNode;
    activeTarget: string | undefined;
    building = false;

    private watcher: fs.FSWatcher | undefined;
    private timer: NodeJS.Timeout | undefined;

    constructor(
        project: ProjectNode,
        readonly workspaceRoot: string,
        readonly artifacts: ArtifactPaths
    ) {
        this.project = project;
    }

    watch(onChange: () => void, onError: (error: Error) => void): void {
        try {
            this.watcher = fs.watch(this.project.path, { persistent: false }, onChange);
            this.watcher.on('error', onError);
        } catch (error) {
            onError(error as Error);
        }
    }

    schedule(onReload: () => void, delay = 300): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.timer = undefined;
            onReload();
        }, delay);
    }

    dispose(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.watcher?.close();
        this.watcher = undefined;
    }
}

function readDependencies(
    projectDirectory: string,
    target: TargetNode,
    source: SourceNode
): readonly SourceNode[] {
    if (!source.includedInBuild || target.outputDirectory === undefined) {
        return [];
    }

    const outputDirectory = resolveProjectPath(projectDirectory, target.outputDirectory);
    const dependencyFile = join(outputDirectory, `${basename(source.path, extname(source.path))}.d`);

    let content: string;
    try {
        content = fs.readFileSync(dependencyFile, 'utf8');
    } catch {
        return [];
    }

    const paths = uniquePaths(
        parseDependencyFile(content)
            .map((path) => resolveProjectPath(projectDirectory, path))
            .filter((path) => path.toLowerCase() !== source.path.toLowerCase())
    );

    return paths.map((path) => ({
        label: basename(path),
        path,
        dir: dirname(path),
        kind: sourceKindOf(path),
        includedInBuild: true,
        exists: fs.existsSync(path),
        dependencies: []
    }));
}

function selectedTarget(project: ProjectNode, current: string | undefined): string | undefined {
    return current !== undefined && project.targets.some((target) => target.name === current)
        ? current
        : project.targets[0]?.name;
}

function isFileLocked(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function readText(file: string): string {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

function clock(): string {
    return new Date().toLocaleTimeString(undefined, { hour12: false });
}
