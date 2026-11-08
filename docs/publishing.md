# Publishing

A checklist for turning this repository into a `.vsix` / marketplace release.
Nothing here runs automatically; it is the human step before `git push` and
before publishing.

## 1. Identity

Everything is already filled in for this extension:

| Field | Value | Notes |
| --- | --- | --- |
| `publisher` | `yxzly6819` | Extensions id: `yxzly6819.keil-assistant-live` |
| `name` | `keil-assistant-live` | Never change it after the first release |
| `displayName` | `Keil Assistant Live` | Shown in the marketplace |
| `version` | `1.0.0` | First release of this extension |
| `author` | `yxzly6819 <yxzly6819@163.com>` | |
| `repository` / `homepage` / `bugs` | `github.com/yxzly6819/keil-assistant-live` | |

**Deliberate decision: the internal ids are unchanged from upstream**
(`project.build`, the `project` view, `KeilAssistant.*` settings). That keeps the
code simple, but it means this extension **cannot be installed alongside
`cl.keil-assistant`**. This is documented in `README.md`, `README_EN.md`,
`CHANGELOG.md` and `docs/behaviour.md#2-non-goals`; keep those statements if the
decision ever changes.

## 2. Licence

- `LICENSE` keeps the upstream line `Copyright (c) 2020 cl` and adds
  `Copyright (c) 2026 yxzly6819`. MIT requires keeping the original notice;
  never delete the upstream line.
- The provenance section in both READMEs must keep saying that this is an
  independent rewrite based on the upstream project.

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

That writes `keil-assistant-live-<version>.vsix`. It is git-ignored, so it will
not end up in the commit.

## 5. Sanity checks before pushing

- `pnpm run test` → 47/47
- `pnpm run compile` → no type errors
- `pnpm run package` → webpack succeeds, `dist/extension.js` exists
- open a real Keil project with `F5`: the tree loads, build streams output into
  `Keil Assistant`, errors land in the Problems panel, and `.vscode` is created
  in the workspace — **not** next to the `.uvprojx`
- the upstream extension is uninstalled, or the new one will not load
- `git status` is clean and `git log` does not contain the demo project or the
  generated `.vscode` folder

## 6. Things that are intentionally not automatic

- `dist/` is git-ignored: consumers of the repository must build it.
- The extension does not generate `tasks.json` or `launch.json`; those are listed
  as open questions in `docs/behaviour.md` §6.
- `bin/Uv4Caller.exe` is kept as a historical reference only. If it is ever
  deleted, also drop the appendix in `docs/behaviour.md`.
