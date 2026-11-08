import { dirname } from 'node:path';
import * as vscode from 'vscode';

import { BuildAction } from './core/command';
import { ProjectExplorer, SourceItem, ViewItem } from './vscode/explorer';
import { IconTheme } from './vscode/icons';
import { Logger } from './vscode/logger';
import { ProjectStore } from './vscode/projectStore';

export function activate(context: vscode.ExtensionContext): void {
    const channel = vscode.window.createOutputChannel('Keil Assistant');
    const logger = new Logger(channel);
    const store = new ProjectStore(logger);
    const explorer = new ProjectExplorer(store, new IconTheme(context.extensionPath));
    const tree = vscode.window.createTreeView('project', { treeDataProvider: explorer });

    context.subscriptions.push(
        channel,
        store,
        explorer,
        tree,
        ...registerCommands(store, explorer, channel),
        vscode.workspace.onDidChangeWorkspaceFolders(() => void store.restore())
    );

    void store.restore();
}

export function deactivate(): void {
    // Everything is disposed through `context.subscriptions`.
}

function registerCommands(
    store: ProjectStore,
    explorer: ProjectExplorer,
    channel: vscode.OutputChannel
): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('explorer.open', () => openProject(store)),
        vscode.commands.registerCommand('keil-assistant.showOutput', () => channel.show(true)),
        vscode.commands.registerCommand('project.close', (item?: ViewItem) => {
            const loaded = item?.loaded ?? store.getActiveProject();
            if (loaded !== undefined) {
                store.close(loaded.project.id);
            }
        }),
        vscode.commands.registerCommand('project.active', (item?: ViewItem) => {
            const loaded = item?.loaded ?? store.getActiveProject();
            if (loaded !== undefined) {
                store.activate(loaded.project.id);
            }
        }),
        vscode.commands.registerCommand('project.switch', (item?: ViewItem) => {
            const loaded = item?.loaded ?? store.getActiveProject();
            return loaded === undefined ? undefined : store.switchTarget(loaded.project.id);
        }),
        vscode.commands.registerCommand('project.openLog', (item?: ViewItem) => {
            const loaded = item?.loaded ?? store.getActiveProject();
            return loaded === undefined ? undefined : store.openLog(loaded.project.id);
        }),
        vscode.commands.registerCommand('project.build', runBuild(store, 'build')),
        vscode.commands.registerCommand('project.rebuild', runBuild(store, 'rebuild')),
        vscode.commands.registerCommand('project.download', runBuild(store, 'download')),
        vscode.commands.registerCommand('item.copyValue', (item?: ViewItem) => {
            if (item?.kind === 'source') {
                return vscode.env.clipboard.writeText(item.source.path);
            }
            return undefined;
        }),
        vscode.commands.registerCommand('keil-assistant.openSource', (item: SourceItem) =>
            explorer.openSource(item.source)
        )
    ];
}

/** The command argument is the tree item the button was pressed on. */
function runBuild(store: ProjectStore, action: BuildAction) {
    return (item?: ViewItem): void => {
        const loaded = item?.loaded ?? store.getActiveProject();
        if (loaded === undefined) {
            void vscode.window.showWarningMessage('Open a uVision project first.');
            return;
        }
        const targetName = item?.kind === 'target' ? item.target.name : loaded.activeTarget;
        void store.build(loaded.project.id, targetName, action);
    };
}

async function openProject(store: ProjectStore): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
        openLabel: 'Open uVision project',
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'uVision project': ['uvproj', 'uvprojx'] }
    });
    if (selected === undefined || selected.length === 0) {
        return;
    }

    const projectPath = selected[0].fsPath;
    try {
        await store.open(projectPath);
    } catch (error) {
        void vscode.window.showErrorMessage(`Cannot open the project: ${messageOf(error)}`);
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'Project loaded. Switch the window to its folder?',
        'Switch',
        'Later'
    );
    if (choice === 'Switch') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(dirname(projectPath)));
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
