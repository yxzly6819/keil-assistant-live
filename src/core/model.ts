/**
 * Pure project model. Nothing in this file (or in `core/` in general) may import
 * `vscode` or touch the file system: the model is reconstructed from a project
 * file and handed to the view layer, never the other way round.
 */

import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';

export type ToolchainId = 'C51' | 'ARM';

export type CompilerId = 'c51' | 'armcc' | 'armclang';

export type SourceKind = 'c' | 'cpp' | 'header' | 'assembler' | 'library' | 'other';

export interface SourceNode {
    readonly label: string;
    readonly path: string;
    readonly dir: string;
    readonly kind: SourceKind;
    /** False when the file or its group is excluded from the build in uVision. */
    readonly includedInBuild: boolean;
    /** False when the file is referenced by the project but missing on disk. */
    readonly exists: boolean;
    readonly dependencies: readonly SourceNode[];
}

export interface FileGroupNode {
    readonly label: string;
    readonly includedInBuild: boolean;
    readonly sources: readonly SourceNode[];
}

export interface TargetNode {
    readonly name: string;
    readonly compiler: CompilerId;
    readonly groups: readonly FileGroupNode[];
    readonly includes: readonly string[];
    readonly defines: readonly string[];
    /** uVision output directory, relative to the project unless absolute. */
    readonly outputDirectory?: string;
}

export interface ProjectNode {
    readonly id: string;
    readonly name: string;
    readonly path: string;
    readonly dir: string;
    readonly toolchain: ToolchainId;
    readonly schemaVersion?: string;
    readonly targets: readonly TargetNode[];
}

/** Everything the parser needs to know about the installed Keil toolchain. */
export interface ToolchainContext {
    readonly systemIncludes: readonly string[];
    readonly systemDefines: readonly string[];
}

export interface ToolchainResolver {
    readonly id: ToolchainId;
    resolve(compiler: CompilerId): ToolchainContext;
}

/** Stable, short id derived from the project path; used for artifact file names. */
export function projectIdFor(projectPath: string): string {
    return createHash('md5').update(projectPath.toLowerCase()).digest('hex').slice(0, 8);
}

export function projectNameOf(projectPath: string): string {
    return basename(projectPath, extname(projectPath));
}

export function findTarget(project: ProjectNode, name: string | undefined): TargetNode | undefined {
    if (name === undefined) {
        return project.targets[0];
    }
    return project.targets.find((target) => target.name === name);
}

export function sourceKindOf(filePath: string): SourceKind {
    switch (extname(filePath).toLowerCase()) {
        case '.c':
            return 'c';
        case '.cpp':
        case '.cxx':
        case '.cc':
        case '.c++':
            return 'cpp';
        case '.h':
        case '.hpp':
        case '.hh':
        case '.hxx':
        case '.inc':
            return 'header';
        case '.s':
        case '.asm':
        case '.a51':
            return 'assembler';
        case '.lib':
        case '.a':
        case '.o':
        case '.obj':
            return 'library';
        default:
            return 'other';
    }
}

/** Returns a copy of `project` where every source carries its dependency list. */
export function withDependencies(
    project: ProjectNode,
    lookup: (target: TargetNode, source: SourceNode) => readonly SourceNode[]
): ProjectNode {
    return {
        ...project,
        targets: project.targets.map((target) => ({
            ...target,
            groups: target.groups.map((group) => ({
                ...group,
                sources: group.sources.map((source) => ({
                    ...source,
                    dependencies: lookup(target, source)
                }))
            }))
        }))
    };
}
