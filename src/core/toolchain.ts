/**
 * Knowledge about the installed Keil toolchains: where their headers live and
 * which macros they predefine. File system access is injected, so this module
 * stays pure and testable.
 */

import { dirname, join } from 'node:path';

import {
    ARMCC_MACROS,
    ARMCLANG_MACROS,
    ARMCLANG_FALLBACK_MACROS,
    C51_MACROS,
    parseMacroDump
} from './macros';
import { CompilerId, ToolchainContext, ToolchainId, ToolchainResolver } from './model';

export interface ToolchainProbe {
    exists(path: string): boolean;
    /** Directories below the compiler include directory (CMSIS, C++ headers, ...). */
    listDirectories(path: string): string[];
}

export interface ToolchainOptions {
    readonly id: ToolchainId;
    /** Absolute path of `UV4.exe`; the Keil root is derived from it. */
    readonly uv4Path: string | undefined;
    readonly probe: ToolchainProbe;
    /** Output of `armclang -E -dM -`, when available. */
    readonly armclangMacros?: readonly string[];
}

export function createToolchainResolver(options: ToolchainOptions): ToolchainResolver {
    const keilRoot = options.uv4Path === undefined ? undefined : dirname(dirname(options.uv4Path));

    const includeDirectory = (tool: string): string[] => {
        if (keilRoot === undefined) {
            return [];
        }
        const root = join(keilRoot, 'ARM', tool, 'include');
        if (!options.probe.exists(root)) {
            return [];
        }
        return [root, ...options.probe.listDirectories(root)];
    };

    const c51Includes =
        keilRoot === undefined ? [] : [join(keilRoot, 'C51', 'INC')].filter((dir) => options.probe.exists(dir));

    const armclangDefines = [
        ...ARMCLANG_MACROS,
        ...(options.armclangMacros ?? ARMCLANG_FALLBACK_MACROS)
    ];

    return {
        id: options.id,
        resolve(compiler: CompilerId): ToolchainContext {
            switch (compiler) {
                case 'c51':
                    return { systemIncludes: c51Includes, systemDefines: C51_MACROS };
                case 'armclang':
                    return { systemIncludes: includeDirectory('ARMCLANG'), systemDefines: armclangDefines };
                case 'armcc':
                    return { systemIncludes: includeDirectory('ARMCC'), systemDefines: ARMCC_MACROS };
            }
        }
    };
}

export { parseMacroDump };
