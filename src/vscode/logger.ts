import * as fs from 'node:fs';
import { dirname } from 'node:path';
import * as vscode from 'vscode';

import { classifyLogLine, LogLevel } from '../core/outputlog';

/**
 * Everything the extension has to say goes to one log output channel, which
 * renders the severity of every line (info / warning / error). When the caller
 * passes a log file the same text is appended there with a timestamp.
 */
export class Logger {
    constructor(private readonly channel: vscode.LogOutputChannel) {}

    info(logFile: string | undefined, message: string): void {
        this.write('info', logFile, message);
    }

    warning(logFile: string | undefined, message: string): void {
        this.write('warn', logFile, message);
    }

    error(logFile: string | undefined, message: string): void {
        this.write('error', logFile, message);
    }

    /** A line of tool output; its level is derived from the text itself. */
    line(text: string): void {
        this.emit(classifyLogLine(text), text);
    }

    level(level: LogLevel, text: string): void {
        this.emit(level, text);
    }

    /** Brings the output panel forward without stealing keyboard focus. */
    show(): void {
        this.channel.show(true);
    }

    private write(level: LogLevel, logFile: string | undefined, message: string): void {
        this.emit(level, message);
        if (logFile !== undefined) {
            appendLine(logFile, `${new Date().toISOString()} [${level}] ${message}`);
        }
    }

    private emit(level: LogLevel, text: string): void {
        switch (level) {
            case 'error':
                this.channel.error(text);
                break;
            case 'warn':
                this.channel.warn(text);
                break;
            case 'info':
                this.channel.info(text);
                break;
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
