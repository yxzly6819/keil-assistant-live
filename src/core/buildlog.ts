/**
 * Small helpers that pick the interesting lines out of the uVision build log.
 * They are pure so the view layer can decide what to show.
 */

const ERROR_SUMMARY = /\d+\s+Error\(s\),\s*\d+\s+Warning\(s\)/;
const FLASH_RESULT = /Programming Done|Verify OK|Flash Load finished|Erase Done/;

export function buildSummary(text: string): string | undefined {
    return findLine(text, ERROR_SUMMARY);
}

export function flashSummary(text: string): string | undefined {
    return findLine(text, FLASH_RESULT);
}

export function findLine(text: string, pattern: RegExp): string | undefined {
    for (const line of text.split(/\r\n|\r|\n/)) {
        const trimmed = line.replace(/\u0000/g, '').trim();
        if (trimmed !== '' && pattern.test(trimmed)) {
            return trimmed;
        }
    }
    return undefined;
}
