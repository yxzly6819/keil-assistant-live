import * as vscode from 'vscode';

export type BuildState = 'ok' | 'warnings' | 'failure';

const RESULT_TIMEOUT_MS = 5000;

/**
 * A quiet progress indicator: one status bar entry instead of a task terminal
 * full of chrome.
 */
export class BuildStatus implements vscode.Disposable {
    private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    private timer: NodeJS.Timeout | undefined;

    constructor(showOutputCommand: string) {
        this.item.command = showOutputCommand;
    }

    start(label: string): void {
        this.clearTimer();
        this.item.text = `$(sync~spin) Keil: ${label}`;
        this.item.tooltip = 'Show the build output';
        this.item.show();
    }

    finish(state: BuildState, label: string): void {
        this.clearTimer();
        this.item.text = `${icon(state)} Keil: ${label}`;
        this.item.show();
        this.timer = setTimeout(() => this.item.hide(), RESULT_TIMEOUT_MS);
    }

    dispose(): void {
        this.clearTimer();
        this.item.dispose();
    }

    private clearTimer(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}

function icon(state: BuildState): string {
    switch (state) {
        case 'ok':
            return '$(check)';
        case 'warnings':
            return '$(warning)';
        case 'failure':
            return '$(error)';
    }
}
