/**
 * uVision writes the compiler output to the file given with `-o`, because
 * `UV4.exe` is a GUI subsystem program and prints nothing to the console.
 *
 * Both compilers use the same shape, and uVision sometimes glues several
 * messages onto a single line:
 *
 *   ../Core/Src/main.c(203): error: #20: identifier "x" is undefined
 *   ../User/include/key.h(4): warning: typedef requires a name [-Wmissing-declarations]
 *   ../User/src/ic.c(2): warning: In file included from...../key.h(4): warning: typedef …
 *
 * armclang can also emit the GCC form:
 *
 *   ../Core/Src/main.c:12:5: error: expected ';'
 */

export type BuildSeverity = 'error' | 'warning';

export interface BuildDiagnostic {
    readonly file: string;
    readonly line: number;
    readonly column?: number;
    readonly severity: BuildSeverity;
    readonly message: string;
}

const PAREN_STYLE = /((?:[A-Za-z]:)?[^\s()]*)\((\d+)\)\s*:\s*(fatal error|error|warning)\s*:\s*/g;
const COLON_STYLE = /^(.+?):(\d+):(\d+):\s*(fatal error|error|warning)\s*:\s*(.*)$/;

export function parseBuildOutput(text: string): BuildDiagnostic[] {
    const diagnostics: BuildDiagnostic[] = [];
    const seen = new Set<string>();

    for (const rawLine of text.split(/\r\n|\r|\n/)) {
        const line = rawLine.replace(/\u0000/g, '').trimEnd();
        if (line.trim() === '') {
            continue;
        }

        for (const diagnostic of parseLine(line)) {
            const key = `${diagnostic.file}|${diagnostic.line}|${diagnostic.severity}|${diagnostic.message}`;
            if (!seen.has(key)) {
                seen.add(key);
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

function parseLine(line: string): BuildDiagnostic[] {
    const matches = [...line.matchAll(PAREN_STYLE)];
    if (matches.length > 0) {
        return matches
            .map((match, index) => {
                const messageStart = (match.index ?? 0) + match[0].length;
                const messageEnd = index + 1 < matches.length ? (matches[index + 1].index ?? line.length) : line.length;
                // "In file included from" runs straight into the next path.
                const file = match[1].trim().replace(/^from(?=\.|\/|\\)/i, '');
                const message = line.slice(messageStart, messageEnd).trim();
                if (file === '') {
                    return undefined;
                }
                return {
                    file,
                    line: Number(match[2]),
                    severity: severityOf(match[3]),
                    message
                };
            })
            .filter((diagnostic): diagnostic is BuildDiagnostic => diagnostic !== undefined);
    }

    const colon = COLON_STYLE.exec(line);
    if (colon !== null) {
        return [
            {
                file: colon[1].trim(),
                line: Number(colon[2]),
                column: Number(colon[3]),
                severity: severityOf(colon[4]),
                message: colon[5].trim()
            }
        ];
    }

    return [];
}

function severityOf(keyword: string): BuildSeverity {
    return keyword === 'warning' ? 'warning' : 'error';
}
