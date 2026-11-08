import * as fs from 'node:fs';
import { join } from 'node:path';

/**
 * Where the extension is allowed to write.
 *
 * Nothing is ever created inside the uVision project directory: `c_cpp_properties.json`
 * must live in `<workspace>/.vscode` for cpptools to read it, and the logs live in
 * `<workspace>/.vscode/keil-assistant/`, one file per project.
 */
export class ArtifactPaths {
    constructor(
        readonly workspaceRoot: string,
        readonly projectId: string
    ) {}

    get vscodeDirectory(): string {
        return join(this.workspaceRoot, '.vscode');
    }

    get stateDirectory(): string {
        return join(this.vscodeDirectory, 'keil-assistant');
    }

    get logFile(): string {
        return join(this.stateDirectory, `${this.projectId}.log`);
    }

    /** Compiler output written by `UV4.exe -o`; parsed into diagnostics. */
    get buildLogFile(): string {
        return join(this.stateDirectory, `${this.projectId}.build.log`);
    }

    /** Generated wrapper that runs uVision and echoes its log into the terminal. */
    get buildScriptFile(): string {
        return join(this.stateDirectory, `${this.projectId}.build.cmd`);
    }

    ensureStateDirectory(): void {
        fs.mkdirSync(this.stateDirectory, { recursive: true });
    }
}

export function cppPropertiesFileFor(workspaceRoot: string): string {
    return join(workspaceRoot, '.vscode', 'c_cpp_properties.json');
}
