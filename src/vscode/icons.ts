import * as fs from 'node:fs';
import { basename, join } from 'node:path';
import * as vscode from 'vscode';

/** Icons are looked up by name so the view layer never hard-codes a path. */
export class IconTheme {
    private readonly icons = new Map<string, vscode.Uri>();

    constructor(extensionPath: string) {
        const directory = join(extensionPath, 'res', 'icons');
        try {
            for (const entry of fs.readdirSync(directory)) {
                if (entry.toLowerCase().endsWith('.svg')) {
                    this.icons.set(basename(entry, '.svg'), vscode.Uri.file(join(directory, entry)));
                }
            }
        } catch {
            // A missing theme is not fatal; the tree simply renders without icons.
        }
    }

    get(name: string): { light: vscode.Uri; dark: vscode.Uri } | undefined {
        const uri = this.icons.get(name);
        return uri === undefined ? undefined : { light: uri, dark: uri };
    }
}
