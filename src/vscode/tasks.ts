import * as vscode from 'vscode';

import { Uv4Command } from '../core/command';

/**
 * Runs one uVision batch operation as a VS Code task.
 *
 * Task shell executions are the only way to keep the `problemMatchers` working,
 * and `onDidEndTaskProcess` gives us uVision's exit code back, which is what
 * build success is decided on.
 */
export async function runUv4Task(
    command: Uv4Command,
    label: string,
    problemMatchers: readonly string[]
): Promise<number | undefined> {
    const execution = new vscode.ShellExecution(command.executable, [...command.args]);
    const task = new vscode.Task(
        { type: 'keil-task' },
        vscode.TaskScope.Global,
        label,
        'keil',
        execution,
        [...problemMatchers]
    );
    task.isBackground = false;
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Shared,
        echo: true,
        clear: false,
        focus: false
    };

    let started: vscode.TaskExecution | undefined;
    return new Promise<number | undefined>((resolve, reject) => {
        const listener = vscode.tasks.onDidEndTaskProcess((event) => {
            if (event.execution === started) {
                listener.dispose();
                resolve(event.exitCode);
            }
        });
        vscode.tasks.executeTask(task).then(
            (taskExecution) => {
                started = taskExecution;
            },
            (error: Error) => {
                listener.dispose();
                reject(error);
            }
        );
    });
}
