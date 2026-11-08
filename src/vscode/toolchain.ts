import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';

import { ToolchainId, ToolchainResolver } from '../core/model';
import { createToolchainResolver, parseMacroDump } from '../core/toolchain';
import { Settings, uv4PathFor } from './config';

const MACRO_TIMEOUT_MS = 10000;

let cachedExecutable: string | undefined;
let cachedMacros: string[] | undefined;
let pending: Promise<void> | undefined;

export function resolverFor(toolchain: ToolchainId, settings: Settings): ToolchainResolver {
    const uv4Path = uv4PathFor(toolchain, settings);
    return createToolchainResolver({
        id: toolchain,
        uv4Path,
        probe: {
            exists: (path) => fs.existsSync(path),
            listDirectories
        },
        armclangMacros: cachedMacros
    });
}

/**
 * armclang knows its own predefined macros better than we do, so they are
 * collected once, asynchronously, before the first project is parsed. Doing this
 * with `execFileSync` would block the extension host, which can be noticeable
 * while a debugger is attached.
 */
export async function preloadArmclangMacros(settings: Settings): Promise<void> {
    const uv4Path = uv4PathFor('ARM', settings);
    if (uv4Path === undefined) {
        return;
    }

    const executable = join(dirname(dirname(uv4Path)), 'ARM', 'ARMCLANG', 'bin', 'armclang.exe');
    if (cachedExecutable === executable && cachedMacros !== undefined) {
        return;
    }
    if (!fs.existsSync(executable)) {
        return;
    }
    if (pending !== undefined) {
        return pending;
    }

    pending = collectMacros(executable).finally(() => {
        pending = undefined;
    });
    return pending;
}

function collectMacros(executable: string): Promise<void> {
    return new Promise<void>((resolve) => {
        let settled = false;
        const finish = (macros: string[] | undefined): void => {
            if (settled) {
                return;
            }
            settled = true;
            if (macros !== undefined) {
                cachedExecutable = executable;
                cachedMacros = macros;
            }
            resolve();
        };

        const child = spawn(executable, ['--target=arm-arm-none-eabi', '-E', '-dM', '-'], {
            windowsHide: true
        });

        let output = '';
        child.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });
        child.on('error', () => finish(undefined));
        child.on('close', (code) => {
            finish(code === 0 ? parseMacroDump(output.split(/\r\n|\r|\n/)) : undefined);
        });

        // `armclang -E -dM -` reads its input from stdin; without EOF it waits.
        child.stdin.end();

        setTimeout(() => {
            child.kill();
            finish(undefined);
        }, MACRO_TIMEOUT_MS).unref();
    });
}

function listDirectories(directory: string): string[] {
    try {
        return fs
            .readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => join(directory, entry.name));
    } catch {
        return [];
    }
}
