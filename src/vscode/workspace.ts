import * as fs from 'node:fs';
import * as os from 'node:os';
import { basename, dirname, isAbsolute, relative } from 'node:path';
import * as vscode from 'vscode';

import { expandPathVariables } from '../core/paths';
import { Settings } from './config';

const PROJECT_GLOB = '**/*.{uvproj,uvprojx}';
const SEARCH_EXCLUDE = '**/{node_modules,.git,out,dist}/**';
const MAX_RESULTS = 100;

export interface ProjectRoot {
    readonly root: string;
    /** True when no workspace folder exists and the project directory is used instead. */
    readonly fallback: boolean;
}

/**
 * The directory whose `.vscode` we are allowed to write to. It is the workspace
 * folder that contains the project, falling back to the first folder, and only
 * to the project directory when the window has no folder at all.
 */
export function resolveProjectRoot(projectPath: string): ProjectRoot {
    const folders = vscode.workspace.workspaceFolders ?? [];

    const containing = folders.find((folder) => isInside(folder.uri.fsPath, projectPath));
    if (containing !== undefined) {
        return { root: containing.uri.fsPath, fallback: false };
    }
    if (folders.length > 0) {
        return { root: folders[0].uri.fsPath, fallback: false };
    }

    const workspaceFile = vscode.workspace.workspaceFile;
    if (workspaceFile !== undefined && workspaceFile.scheme === 'file') {
        return { root: dirname(workspaceFile.fsPath), fallback: false };
    }

    return { root: dirname(projectPath), fallback: true };
}

/** Project files in the workspace plus the ones listed in the settings. */
export async function discoverProjects(settings: Settings): Promise<string[]> {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const found = new Set<string>();

    for (const folder of folders) {
        const pattern = new vscode.RelativePattern(folder, PROJECT_GLOB);
        for (const uri of await vscode.workspace.findFiles(pattern, SEARCH_EXCLUDE, MAX_RESULTS)) {
            found.add(uri.fsPath);
        }
    }

    for (const location of settings.fileLocationList) {
        for (const path of await resolveLocation(location, folders)) {
            found.add(path);
        }
    }

    const excluded = new Set(settings.excludeList.map((name) => name.toLowerCase()));
    return [...found]
        .filter((path) => fs.existsSync(path))
        .filter((path) => !excluded.has(basename(path).toLowerCase()))
        .sort((left, right) => left.localeCompare(right));
}

async function resolveLocation(location: string, folders: readonly string[]): Promise<string[]> {
    const expanded = expandPathVariables(location, {
        workspaceFolder: folders[0],
        userHome: os.homedir(),
        env: process.env
    });

    if (/[*?]/.test(expanded)) {
        const uris = await vscode.workspace.findFiles(expanded, SEARCH_EXCLUDE, MAX_RESULTS);
        return uris.map((uri) => uri.fsPath);
    }
    return [expanded];
}

function isInside(root: string, path: string): boolean {
    const relativePath = relative(root, path);
    return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}
