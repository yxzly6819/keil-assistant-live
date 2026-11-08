import * as vscode from 'vscode';

/**
 * Runs one uVision batch operation as a VS Code task.
 *
 * The task executes a generated `.cmd` wrapper (see `batchScript`), which runs
 * uVision, prints its log into the task terminal and exits with uVision's own
 * status. `onDidEndTaskProcess` therefore still reports the real verdict.
 */
export async function runBuildScript(scriptPath: string, label: string): Promise<number | undefined> {
    const shell = process.env.ComSpec ?? 'cmd.exe';
    const execution = new vscode.ShellExecution(shell, ['/d', '/s', '/c', scriptPath]);
    const task = new vscode.Task({ type: 'keil-task' }, vscode.TaskScope.Global, label, 'keil', execution);
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
