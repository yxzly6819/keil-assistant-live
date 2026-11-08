/** Expansion of the `${...}` variables allowed in settings values. */

import { basename } from 'node:path';

export interface VariableScope {
    readonly workspaceFolder?: string;
    readonly userHome?: string;
    readonly env?: Readonly<Record<string, string | undefined>>;
}

const VARIABLE_PATTERN = /\$\{([^}]+)\}/g;

export function expandPathVariables(text: string, scope: VariableScope): string {
    return text.replace(VARIABLE_PATTERN, (match, rawName: string) => {
        const name = rawName.trim();
        switch (name) {
            case 'workspaceFolder':
            case 'workspaceRoot':
                return scope.workspaceFolder ?? match;
            case 'workspaceFolderBasename':
                return scope.workspaceFolder === undefined ? match : basename(scope.workspaceFolder);
            case 'userHome':
                return scope.userHome ?? match;
            default:
                break;
        }
        if (name.startsWith('env:')) {
            return scope.env?.[name.slice('env:'.length)] ?? match;
        }
        return match;
    });
}
