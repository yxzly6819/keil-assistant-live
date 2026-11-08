import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

import { Uv4Command } from '../core/command';
import { tailFrom } from '../core/logtail';

const POLL_INTERVAL_MS = 250;

export interface RunOptions {
    readonly command: Uv4Command;
    /** `UV4.exe` prints nothing, so this file is the only source of output. */
    readonly outputLog: string;
    readonly onOutput: (chunk: string) => void;
}

/**
 * Runs uVision and streams its `-o` log while it runs.
 *
 * Using a child process instead of a VS Code task keeps the terminal quiet: the
 * task UI adds a header, a "terminal will be reused" line and an exit line for
 * every run, and shared task panels stack those blocks.
 */
export function runUv4(options: RunOptions): Promise<number | undefined> {
    let offset = 0;

    const pump = (): void => {
        let content: string;
        try {
            content = fs.readFileSync(options.outputLog, 'utf8');
        } catch {
            return;
        }
        const chunk = tailFrom(content, offset);
        offset = chunk.offset;
        if (chunk.text !== '') {
            options.onOutput(chunk.text);
        }
    };

    return new Promise<number | undefined>((resolve) => {
        // uVision is a GUI program; there is nothing useful on its stdio.
        const child = spawn(options.command.executable, [...options.command.args], {
            windowsHide: true,
            stdio: 'ignore'
        });

        const timer = setInterval(pump, POLL_INTERVAL_MS);
        let settled = false;
        const finish = (code: number | undefined): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearInterval(timer);
            pump();
            resolve(code);
        };

        child.on('error', () => finish(undefined));
        child.on('close', (code) => finish(code ?? undefined));
    });
}
