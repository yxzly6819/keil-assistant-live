/**
 * Dependency files (`.d`) written next to the object files by armcc/armclang.
 *
 * Both formats describe `target: dependency...`, optionally continued with a
 * trailing backslash. Paths may escape spaces as `\ `. A backslash is only an
 * escape when it precedes a space — otherwise it is a path separator.
 */

export function parseDependencyFile(content: string): string[] {
    const joined = content.replace(/\\\r?\n/g, ' ');
    const lines = joined.split(/\r\n|\r|\n/);

    const chunks: string[] = [];
    let current: string | undefined;

    for (const line of lines) {
        const separator = /:\s/.exec(line);
        if (separator !== null) {
            if (current !== undefined) {
                chunks.push(current);
            }
            current = line.slice(separator.index + 1);
        } else if (current !== undefined) {
            current += ` ${line}`;
        }
        // Everything before the first "target: " is the object file; ignore it.
    }

    if (current !== undefined) {
        chunks.push(current);
    }

    const seen = new Set<string>();
    const dependencies: string[] = [];
    for (const chunk of chunks) {
        for (const token of splitTokens(chunk)) {
            const key = token.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                dependencies.push(token);
            }
        }
    }
    return dependencies;
}

function splitTokens(text: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];

        if (char === '\\' && (next === ' ' || next === '\t')) {
            current += next;
            index++;
            continue;
        }
        if (char === ' ' || char === '\t' || char === '\r') {
            if (current !== '') {
                tokens.push(current);
                current = '';
            }
            continue;
        }
        current += char;
    }

    if (current !== '') {
        tokens.push(current);
    }
    return tokens;
}
