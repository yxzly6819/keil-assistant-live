/** The three uVision batch operations this extension exposes. */

export type BuildAction = 'build' | 'rebuild' | 'download';

export interface Uv4Command {
    readonly executable: string;
    readonly args: readonly string[];
}

/**
 * `-b` build, `-r` rebuild, `-f` flash; `-j0` keeps uVision from asking
 * questions, `-t` selects the target.
 */
const ACTION_FLAGS: Readonly<Record<BuildAction, string>> = {
    build: '-b',
    rebuild: '-r',
    download: '-f'
};

export function uv4Command(
    action: BuildAction,
    uv4Path: string,
    projectPath: string,
    targetName: string,
    outputLog?: string
): Uv4Command {
    const args = [ACTION_FLAGS[action], projectPath, '-j0', '-t', targetName];
    if (outputLog !== undefined) {
        // `UV4.exe` prints nothing to the console; `-o` is the only way to see
        // the compiler messages.
        args.push('-o', outputLog);
    }
    return { executable: uv4Path, args };
}

export function actionTitle(action: BuildAction): string {
    switch (action) {
        case 'build':
            return 'Build';
        case 'rebuild':
            return 'Rebuild';
        case 'download':
            return 'Download';
    }
}

export function problemMatchersFor(toolchain: 'C51' | 'ARM'): string[] {
    return toolchain === 'C51' ? ['$c51'] : ['$armcc', '$gcc'];
}

export type ActionOutcome = 'success' | 'warnings' | 'failure';

export interface ActionResult {
    readonly outcome: ActionOutcome;
    readonly detail: string;
}

/**
 * µVision reports its result through ERRORLEVEL, not just 0/1:
 * 0 = no errors or warnings, 1 = warnings, 2 = errors, 3 = fatal error,
 * 11/12/13/15/20 = project, device, file or conversion problems.
 * A build with warnings still produced an executable, so it counts as success.
 */
const UV4_ERROR_CODES: Readonly<Record<number, string>> = {
    2: 'the build reported errors',
    3: 'uVision stopped on a fatal error',
    11: 'the project file could not be opened for writing',
    12: 'the device was not found in the device database',
    13: 'uVision could not write the project file',
    15: 'an imported XML file could not be read',
    20: 'the project could not be converted'
};

export function classifyExitCode(exitCode: number | undefined): ActionResult {
    if (exitCode === undefined) {
        return { outcome: 'failure', detail: 'the uVision task could not be started' };
    }
    if (exitCode === 0) {
        return { outcome: 'success', detail: 'no errors or warnings' };
    }
    if (exitCode === 1) {
        return { outcome: 'warnings', detail: 'the build finished with warnings' };
    }

    const known = UV4_ERROR_CODES[exitCode];
    return {
        outcome: 'failure',
        detail: known === undefined ? `uVision exited with code ${exitCode}` : `${known} (exit code ${exitCode})`
    };
}
