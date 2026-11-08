import * as fs from 'node:fs';
import { dirname } from 'node:path';
import * as vscode from 'vscode';

/**
 * Everything the extension has to say goes to one output channel, and — when the
 * caller passes a log file — to the per-project log under `.vscode`.
 */
export class Logger {
    constructor(private readonly channel: vscode.OutputChannel) {}

    info(logFile: string | undefined, message: string): void {
        this.write('info', logFile, message);
    }

    warning(logFile: string | undefined, message: string): void {
        this.write('warn', logFile, message);
    }

    error(logFile: string | undefined, message: string): void {
        this.write('error', logFile, message);
    }

    /** Appends already formatted text, e.g. the compiler output of a build. */
    raw(text: string): void {
        this.channel.appendLine(text);
    }

    private write(level: string, logFile: string | undefined, message: string): void {
        const line = `${new Date().toISOString()} [${level}] ${message}`;
        this.channel.appendLine(line);
        if (logFile !== undefined) {
            appendLine(logFile, line);
        }
    }
}

/** Logging must never break the extension, so every failure is swallowed. */
export function appendLine(file: string, line: string): void {
    try {
        fs.mkdirSync(dirname(file), { recursive: true });
        fs.appendFileSync(file, `${line}\n`, 'utf8');
    } catch {
        // ignored on purpose
    }
}
