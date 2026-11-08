/**
 * Decides how a uVision log line should be shown in the output channel.
 *
 * Error and warning lines are one line each, but the summary line
 * (`"…axf" - 0 Error(s), 1 Warning(s).`) carries the counts, so it is coloured
 * from the numbers instead of from the words.
 */

export type LogLevel = 'info' | 'warn' | 'error';

const SUMMARY = /(\d+)\s+Error\(s\),\s*(\d+)\s+Warning\(s\)/;
const ERROR_LINE = /(^|\s)error\s*[:#]|\bfatal error\b|\bError:\s+L\d+/i;
const WARNING_LINE = /(^|\s)warning\s*[:#]/i;
const WARNING_COUNT = /^\d+\s+warning(s)?\b/i;

export function classifyLogLine(line: string): LogLevel {
    const text = line.trim();
    if (text === '') {
        return 'info';
    }

    const summary = SUMMARY.exec(text);
    if (summary !== null) {
        if (Number(summary[1]) > 0) {
            return 'error';
        }
        return Number(summary[2]) > 0 ? 'warn' : 'info';
    }

    if (ERROR_LINE.test(text)) {
        return 'error';
    }
    if (WARNING_LINE.test(text) || WARNING_COUNT.test(text)) {
        return 'warn';
    }
    return 'info';
}
