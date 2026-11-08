import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CompilerId, ToolchainContext, ToolchainId, ToolchainResolver } from '../src/core/model';

/** Reads a project file from `test/fixtures` (paths are not compiled). */
export function fixture(name: string): string {
    return readFileSync(join(process.cwd(), 'test', 'fixtures', name), 'utf8');
}

/** A toolchain whose paths and macros are predictable, so tests can assert on them. */
export function stubResolver(id: ToolchainId): ToolchainResolver {
    return {
        id,
        resolve(compiler: CompilerId): ToolchainContext {
            return {
                systemIncludes: [`C:\\Keil\\ARM\\${compiler}\\include`],
                systemDefines: [`__TEST_${compiler.toUpperCase()}`]
            };
        }
    };
}
