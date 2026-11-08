# Publishing this fork

A checklist for turning this repository into a `.vsix` / marketplace release.
Nothing here runs automatically; it is the human step before `git push` and
before publishing.

## 1. Make the fork's identity yours

`package.json` still carries the upstream identity, because that is where the
fork started. Before publishing, decide what you want:

| Field | Current value | Why it matters |
| --- | --- | --- |
| `publisher` | `cl` | Together with `name` it forms the extension id (`cl.keil-assistant`). Keeping it means installing this fork **replaces** the upstream extension. |
| `author` | upstream author | Shows up in the extension details page. |
| `homepage` / `repository` / `bugs` | upstream URLs | The "Repository" and "Issues" links would point at a project you do not control. |
| `description` | generic | If this is published, say that it is a fork. |
| `version` | `2.0.0` | Semantically a new major version; do not reuse upstream numbers. |

If you want both extensions installed side by side, change `publisher` (or
`name`); otherwise keep `cl.keil-assistant`.

## 2. Keep the licence intact

- `LICENSE` must keep the upstream MIT text and `Copyright (c) 2020 cl`.
- The fork statement lives in `README.md`, `README_EN.md`, `CHANGELOG.md` and
  `docs/behaviour.md`; keep them in sync when the scope changes.

## 3. What goes into the package

`.vscodeignore` is the packaging filter:

- shipped: `dist/`, `res/`, `syntaxes/`, `docs/`, `README*.md`, `CHANGELOG.md`,
  `LICENSE`, `package.json`.
- not shipped: `src/`, `test/`, `out/`, `.vscode/`, `bin/` (the unused
  `Uv4Caller.exe`), lock files, `webpack.config.js`, source maps.

`package.json` points at `./dist/extension.js`, so **build before packaging**:

```bash
pnpm install
pnpm run package          # webpack -> dist/extension.js
```

## 4. Producing the `.vsix`

`@vscode/vsce` needs Node.js on `PATH`:

```bash
pnpm dlx @vscode/vsce package
```

That writes `keil-assistant-<version>.vsix`. It is git-ignored, so it will not
end up in the commit.

## 5. Sanity checks before pushing

- `pnpm run test` → 47/47
- `pnpm run compile` → no type errors
- `pnpm run package` → webpack succeeds, `dist/extension.js` exists
- open a real Keil project with `F5`: tree loads, build streams output, errors
  land in the Problems panel, and `.vscode` is created in the workspace — **not**
  next to the `.uvprojx`
- `git status` is clean and `git log` does not contain the demo project or the
  generated `.vscode` folder

## 6. Things that are intentionally not automatic

- `dist/` is git-ignored: consumers of the repository must build it.
- The extension does not generate `tasks.json` or `launch.json`; those are listed
  as open questions in `docs/behaviour.md` §6.
- `bin/Uv4Caller.exe` is kept as a historical reference only. If you ever delete
  it, also drop the appendix in `docs/behaviour.md`.
