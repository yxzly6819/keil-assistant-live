/**
 * uVision project file -> `ProjectNode`.
 *
 * The parser is pure: it takes the file content plus a `ToolchainResolver` and
 * an optional `fileExists` probe, and returns a model. It never reads the file
 * system itself, which is what makes it testable without VS Code or Keil.
 */

import { basename, dirname, join, normalize, sep } from 'node:path';
import * as xml2js from 'xml2js';

import {
    CompilerId,
    FileGroupNode,
    projectIdFor,
    projectNameOf,
    SourceNode,
    sourceKindOf,
    TargetNode,
    ToolchainId,
    ToolchainResolver,
    ProjectNode
} from './model';

type XmlNode = Record<string, unknown>;

export class ProjectFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProjectFormatError';
    }
}

export interface ParseOptions {
    readonly filePath: string;
    readonly toolchain: ToolchainResolver;
    /** Injected so tests can describe a file tree without touching the disk. */
    readonly fileExists?: (path: string) => boolean;
}

interface ParseContext {
    readonly projectDir: string;
    readonly toolchain: ToolchainResolver;
    readonly fileExists: (path: string) => boolean;
}

export async function parseProject(xml: string, options: ParseOptions): Promise<ProjectNode> {
    const document = await parseXml(xml);
    const project = asNode(document['Project']);
    if (project === undefined) {
        throw new ProjectFormatError('Not a uVision project: the <Project> element is missing.');
    }

    const rawTargets = nodesOf(asNode(project['Targets'])?.['Target']);
    if (rawTargets.length === 0) {
        throw new ProjectFormatError('The project does not contain any <Target>.');
    }

    const context: ParseContext = {
        projectDir: dirname(options.filePath),
        toolchain: options.toolchain,
        fileExists: options.fileExists ?? (() => true)
    };

    const targets = rawTargets.map((rawTarget, index) => parseTarget(rawTarget, index, context));

    return {
        id: projectIdFor(options.filePath),
        name: projectNameOf(options.filePath),
        path: options.filePath,
        dir: context.projectDir,
        toolchain: options.toolchain.id,
        schemaVersion: text(project['SchemaVersion']),
        targets
    };
}

/**
 * Keil stores include paths and file paths with either separator; absolute paths
 * are kept, everything else is resolved against the project directory.
 */
export function resolveProjectPath(projectDir: string, rawPath: string): string {
    const unified = rawPath.trim().replace(/\//g, sep);
    if (unified === '') {
        return projectDir;
    }
    if (/^[a-zA-Z]:/.test(unified) || unified.startsWith('\\\\')) {
        return normalize(unified);
    }
    return normalize(join(projectDir, unified));
}

function parseTarget(raw: XmlNode, index: number, context: ParseContext): TargetNode {
    const name = text(raw['TargetName'])?.trim() || `Target ${index + 1}`;
    const compiler = compilerOf(raw, context.toolchain.id);
    const controls = compiler === 'c51' ? c51Controls(raw, name) : armControls(raw);
    const toolchain = context.toolchain.resolve(compiler);

    const groups = nodesOf(asNode(raw['Groups'])?.['Group']).map((rawGroup) => parseGroup(rawGroup, context));

    const userIncludes = splitList(text(controls['IncludePath']), ';')
        .map((includePath) => resolveProjectPath(context.projectDir, includePath));
    const sourceDirs = groups.flatMap((group) => group.sources.map((source) => source.dir));
    const userDefines = splitList(text(controls['Define']), /[\s,]+/);

    return {
        name,
        compiler,
        groups,
        includes: uniquePaths([...userIncludes, ...toolchain.systemIncludes, ...sourceDirs]),
        defines: uniqueValues([...userDefines, ...toolchain.systemDefines]),
        outputDirectory: outputDirectoryOf(raw)
    };
}

/** ARM keeps the common options beside `TargetArmAds`, C51 keeps them inside `Target51`. */
function outputDirectoryOf(raw: XmlNode): string | undefined {
    const targetOption = asNode(raw['TargetOption']);
    const common =
        asNode(targetOption?.['TargetCommonOption']) ?? asNode(asNode(targetOption?.['Target51'])?.['TargetCommonOption']);
    return text(common?.['OutputDirectory']);
}

function compilerOf(raw: XmlNode, toolchain: ToolchainId): CompilerId {
    if (toolchain === 'C51') {
        return 'c51';
    }
    return text(raw['uAC6']) === '1' ? 'armclang' : 'armcc';
}

function c51Controls(raw: XmlNode, targetName: string): XmlNode {
    const c51 = asNode(asNode(asNode(raw['TargetOption'])?.['Target51'])?.['C51']);
    if (c51 === undefined) {
        throw new ProjectFormatError(
            `Target "${targetName}" is not a C51 target, but the project file has the .uvproj suffix.`
        );
    }
    return asNode(c51['VariousControls']) ?? {};
}

function armControls(raw: XmlNode): XmlNode {
    const ads = asNode(asNode(asNode(raw['TargetOption'])?.['TargetArmAds'])?.['Cads']);
    return asNode(ads?.['VariousControls']) ?? {};
}

function parseGroup(raw: XmlNode, context: ParseContext): FileGroupNode {
    const label = text(raw['GroupName'])?.trim() ?? '';
    const includedInBuild = includeInBuild(raw['GroupOption']);

    const sources: SourceNode[] = [];
    for (const files of nodesOf(raw['Files'])) {
        for (const file of collectFileNodes(files)) {
            const source = parseSource(file, context, includedInBuild);
            if (source !== undefined) {
                sources.push(source);
            }
        }
    }

    return { label: label || 'Group', includedInBuild, sources };
}

function collectFileNodes(files: XmlNode): XmlNode[] {
    const value = files['File'];
    if (Array.isArray(value)) {
        return value.map(asNode).filter(isNode);
    }
    const single = asNode(value);
    return single === undefined ? [] : [single];
}

function parseSource(raw: XmlNode, context: ParseContext, groupIncluded: boolean): SourceNode | undefined {
    const rawPath = text(raw['FilePath'])?.trim() ?? '';
    if (rawPath === '') {
        return undefined;
    }

    const path = resolveProjectPath(context.projectDir, rawPath);

    return {
        label: basename(path),
        path,
        dir: dirname(path),
        kind: sourceKindOf(path),
        includedInBuild: groupIncluded && includeInBuild(raw['FileOption']),
        exists: context.fileExists(path),
        dependencies: []
    };
}

/** uVision marks exclusions with `<IncludeInBuild>0</IncludeInBuild>`. */
function includeInBuild(option: unknown): boolean {
    const property = asNode(asNode(option)?.['CommonProperty']);
    return text(property?.['IncludeInBuild']) !== '0';
}

function splitList(value: string | undefined, separator: string | RegExp): string[] {
    if (value === undefined) {
        return [];
    }
    return value
        .split(separator)
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

/** Windows paths are case insensitive; the extension only supports Windows. */
export function uniquePaths(paths: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const path of paths) {
        const key = path.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(path);
        }
    }
    return result;
}

function uniqueValues(values: readonly string[]): string[] {
    return [...new Set(values)];
}

async function parseXml(xml: string): Promise<XmlNode> {
    try {
        const document: unknown = await xml2js.parseStringPromise(xml, { explicitArray: false });
        return asNode(document) ?? {};
    } catch (error) {
        throw new ProjectFormatError(`The project file is not well-formed XML: ${(error as Error).message}`);
    }
}

function asNode(value: unknown): XmlNode | undefined {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as XmlNode;
    }
    return undefined;
}

function isNode(value: XmlNode | undefined): value is XmlNode {
    return value !== undefined;
}

function nodesOf(value: unknown): XmlNode[] {
    if (Array.isArray(value)) {
        return value.map(asNode).filter(isNode);
    }
    const node = asNode(value);
    return node === undefined ? [] : [node];
}

function text(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    const node = asNode(value);
    const inner = node?.['_'];
    return typeof inner === 'string' ? inner : undefined;
}
