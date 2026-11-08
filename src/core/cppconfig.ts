/**
 * `c_cpp_properties.json` is a file the user owns. We only ever add or refresh
 * the configurations that belong to a Keil target, and we never rewrite a file
 * we could not parse — the caller is expected to back it up instead.
 */

export interface CppConfiguration {
    readonly name: string;
    readonly includePath: readonly string[];
    readonly defines: readonly string[];
}

export interface TargetRef {
    readonly projectId: string;
    readonly projectName: string;
    readonly targetName: string;
}

export class CppPropertiesFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CppPropertiesFormatError';
    }
}

export interface CppPropertiesDocument {
    readonly version: number;
    readonly configurations: Record<string, unknown>[];
    readonly [key: string]: unknown;
}

const DEFAULT_VERSION = 4;
const INTELLISENSE_MODE = '${default}';

export function readCppProperties(content: string | undefined): CppPropertiesDocument {
    if (content === undefined || content.trim() === '') {
        return { version: DEFAULT_VERSION, configurations: [] };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (error) {
        throw new CppPropertiesFormatError(`not valid JSON (${(error as Error).message})`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new CppPropertiesFormatError('the document root is not a JSON object');
    }

    const document = parsed as Record<string, unknown>;
    const configurations = document['configurations'];
    if (configurations !== undefined && !Array.isArray(configurations)) {
        throw new CppPropertiesFormatError('"configurations" is not an array');
    }

    return {
        ...document,
        version: typeof document['version'] === 'number' ? document['version'] : DEFAULT_VERSION,
        configurations: (configurations as Record<string, unknown>[] | undefined) ?? []
    };
}

/** Returns the full file content, with our configurations upserted by name. */
export function updateCppProperties(content: string | undefined, configurations: readonly CppConfiguration[]): string {
    const document = readCppProperties(content);

    for (const configuration of configurations) {
        const entry: Record<string, unknown> = {
            name: configuration.name,
            includePath: [...configuration.includePath],
            defines: [...configuration.defines],
            intelliSenseMode: INTELLISENSE_MODE
        };
        const index = document.configurations.findIndex(
            (existing) => typeof existing === 'object' && existing !== null && existing['name'] === configuration.name
        );
        if (index === -1) {
            document.configurations.push(entry);
        } else {
            document.configurations[index] = { ...document.configurations[index], ...entry };
        }
    }

    return `${JSON.stringify(document, undefined, 4)}\n`;
}

/**
 * A configuration is named after its target when that name is unique in the
 * workspace, and prefixed with the project name when it is not.
 */
export function configNamesFor(targets: readonly TargetRef[]): Map<string, string> {
    const occurrences = new Map<string, number>();
    for (const target of targets) {
        occurrences.set(target.targetName, (occurrences.get(target.targetName) ?? 0) + 1);
    }

    const names = new Map<string, string>();
    for (const target of targets) {
        const unique = (occurrences.get(target.targetName) ?? 0) === 1;
        names.set(
            configKey(target.projectId, target.targetName),
            unique ? target.targetName : `${target.projectName}/${target.targetName}`
        );
    }
    return names;
}

export function configKey(projectId: string, targetName: string): string {
    return `${projectId}\u0000${targetName}`;
}
