import * as fs from 'node:fs';
import * as vscode from 'vscode';

import { CompilerId, findTarget, SourceNode, TargetNode } from '../core/model';
import { IconTheme } from './icons';
import { LoadedProject, ProjectStore } from './projectStore';

export interface ProjectItem {
    readonly kind: 'project';
    readonly loaded: LoadedProject;
}

export interface TargetItem {
    readonly kind: 'target';
    readonly loaded: LoadedProject;
    readonly target: TargetNode;
}

export interface GroupItem {
    readonly kind: 'group';
    readonly loaded: LoadedProject;
    readonly label: string;
    readonly includedInBuild: boolean;
    readonly sources: readonly SourceNode[];
}

export interface SourceItem {
    readonly kind: 'source';
    readonly loaded: LoadedProject;
    readonly source: SourceNode;
}

export type ViewItem = ProjectItem | TargetItem | GroupItem | SourceItem;

const COMPILER_LABELS: Readonly<Record<CompilerId, string>> = {
    c51: 'C51',
    armcc: 'ARMCC (AC5)',
    armclang: 'ARMCLANG (AC6)'
};

/** The tree is a rendering of whatever the store exposes; it owns no state. */
export class ProjectExplorer implements vscode.TreeDataProvider<ViewItem>, vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<ViewItem | undefined>();
    private readonly subscriptions: vscode.Disposable[] = [];
    private lastClick: { readonly path: string; readonly time: number } | undefined;

    readonly onDidChangeTreeData = this.emitter.event;

    constructor(
        private readonly store: ProjectStore,
        private readonly icons: IconTheme
    ) {
        this.subscriptions.push(
            this.emitter,
            store.onDidChange(() => this.emitter.fire(undefined))
        );
    }

    getTreeItem(element: ViewItem): vscode.TreeItem {
        switch (element.kind) {
            case 'project':
                return this.projectItem(element);
            case 'target':
                return this.targetItem(element);
            case 'group':
                return this.groupItem(element);
            case 'source':
                return this.sourceItem(element);
        }
    }

    getChildren(element?: ViewItem): ViewItem[] {
        if (element === undefined) {
            return this.store.list().map((loaded) => ({ kind: 'project', loaded }));
        }

        switch (element.kind) {
            case 'project': {
                const target = findTarget(element.loaded.project, element.loaded.activeTarget);
                return target === undefined ? [] : [{ kind: 'target', loaded: element.loaded, target }];
            }
            case 'target':
                return element.target.groups.map((group) => ({
                    kind: 'group',
                    loaded: element.loaded,
                    label: group.label,
                    includedInBuild: group.includedInBuild,
                    sources: group.sources
                }));
            case 'group':
                return element.sources.map((source) => ({ kind: 'source', loaded: element.loaded, source }));
            case 'source':
                return element.source.dependencies.map((source) => ({
                    kind: 'source',
                    loaded: element.loaded,
                    source
                }));
        }
    }

    dispose(): void {
        for (const subscription of this.subscriptions) {
            subscription.dispose();
        }
    }

    /** Single click previews the file, a second click within 260 ms pins it. */
    async openSource(source: SourceNode): Promise<void> {
        if (!fs.existsSync(source.path)) {
            void vscode.window.showWarningMessage(`File not found: ${source.path}`);
            return;
        }

        const pinned =
            this.lastClick !== undefined &&
            this.lastClick.path === source.path &&
            Date.now() - this.lastClick.time < 260;
        this.lastClick = { path: source.path, time: Date.now() };

        await vscode.window.showTextDocument(vscode.Uri.file(source.path), { preview: !pinned });
    }

    private projectItem(element: ProjectItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.loaded.project.name);
        item.contextValue = 'Project';
        item.description = element.loaded.project.toolchain;
        item.tooltip = element.loaded.project.path;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const active = this.store.getActiveProject()?.project.id === element.loaded.project.id;
        item.iconPath = this.icons.get(active ? 'ActiveApplication_16x' : 'DeactiveApplication_16x');
        return item;
    }

    private targetItem(element: TargetItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.target.name);
        item.contextValue = 'Target';
        item.description = COMPILER_LABELS[element.target.compiler];
        item.tooltip = `${element.target.name} · ${COMPILER_LABELS[element.target.compiler]}`;
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = this.icons.get('Class_16x');
        return item;
    }

    private groupItem(element: GroupItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label);
        item.contextValue = 'FileGroup';
        item.tooltip = element.includedInBuild ? element.label : `${element.label} (excluded from build)`;
        item.collapsibleState =
            element.sources.length === 0
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = this.icons.get(element.includedInBuild ? 'Folder_32x' : 'FolderExclude_32x');
        return item;
    }

    private sourceItem(element: SourceItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.source.label);
        item.contextValue = 'Source';
        item.tooltip = element.source.path;
        item.collapsibleState =
            element.source.dependencies.length === 0
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = this.icons.get(sourceIconName(element.source));
        item.resourceUri = vscode.Uri.file(element.source.path);
        item.command = {
            command: 'keil-assistant.openSource',
            title: 'Open',
            arguments: [element]
        };
        return item;
    }
}

function sourceIconName(source: SourceNode): string {
    if (!source.exists) {
        return 'FileWarning_16x';
    }
    if (!source.includedInBuild) {
        return 'FileExclude_16x';
    }
    switch (source.kind) {
        case 'c':
            return 'CFile_16x';
        case 'cpp':
            return 'CPP_16x';
        case 'header':
            return 'CPPHeaderFile_16x';
        case 'assembler':
            return 'AssemblerSourceFile_16x';
        case 'library':
            return 'Library_16x';
        default:
            return 'Text_16x';
    }
}
