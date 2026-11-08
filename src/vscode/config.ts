import * as vscode from 'vscode';

import { ToolchainId } from '../core/model';

export interface Settings {
    readonly c51Uv4Path: string | undefined;
    readonly armUv4Path: string | undefined;
    readonly excludeList: readonly string[];
    readonly fileLocationList: readonly string[];
}

/** 1.x shipped the literal string "null" as the default value. */
const LEGACY_UNSET = 'null';

export function readSettings(): Settings {
    // Some of these settings are resource scoped; give them the workspace folder
    // as the scope so VS Code does not warn about a missing resource.
    const scope = vscode.workspace.workspaceFolders?.[0]?.uri ?? null;
    const configuration = vscode.workspace.getConfiguration('KeilAssistant', scope);
    return {
        c51Uv4Path: normalizeExecutable(configuration.get<string>('C51.Uv4Path')),
        armUv4Path: normalizeExecutable(configuration.get<string>('MDK.Uv4Path')),
        excludeList: configuration.get<string[]>('Project.ExcludeList') ?? [],
        fileLocationList: configuration.get<string[]>('Project.FileLocationList') ?? []
    };
}

function normalizeExecutable(value: string | undefined | null): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === LEGACY_UNSET) {
        return undefined;
    }
    return trimmed;
}

export function uv4PathFor(toolchain: ToolchainId, settings: Settings): string | undefined {
    return toolchain === 'C51' ? settings.c51Uv4Path : settings.armUv4Path;
}

export function uv4SettingKey(toolchain: ToolchainId): string {
    return toolchain === 'C51' ? 'KeilAssistant.C51.Uv4Path' : 'KeilAssistant.MDK.Uv4Path';
}
