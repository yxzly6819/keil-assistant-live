# Keil Assistant

Open, browse, build and flash Keil uVision 5 projects (`.uvproj` / `.uvprojx`) from VS Code.

Use it together with the [C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools): include paths and preprocessor defines from the Keil project are written to `c_cpp_properties.json`, so IntelliSense matches the real compiler.

> **This is a fork, not the original project.**
> The upstream is [github0null/keil-assistant](https://github.com/github0null/keil-assistant) by **cl** (MIT), which is no longer maintained.
> This repository reworks it as version 2.0: every user-facing feature is kept, the internals are rewritten, and a few defaults changed. See [What changed in 2.0](#what-changed-in-20) and [Provenance and license](#provenance-and-license).

## What changed in 2.0

- **The `.vscode` folder is created in the workspace, not next to the Keil project file.** The project directory is never written to.
- **Builds no longer go through a VS Code task or the terminal.** The extension runs `UV4.exe` as a child process, streams its `-o` log into the `Keil Assistant` output channel, and decides the verdict from uVision's exit code.
- The output channel is a **log channel**: lines are coloured by severity (errors red, warnings yellow) and the panel is brought forward automatically without stealing focus.
- Compiler errors and warnings become entries in the Problems panel (file and line included).
- The three actions are available from the **editor title bar**, the project tree and the keyboard.
- The code is split into a pure core and a thin VS Code layer; the core has 47 unit tests (`pnpm test`).
- The run-time dependency on `Uv4Caller.exe` is gone (analysis in [docs/behaviour.md](docs/behaviour.md#8-appendix-binuv4callerexe)). The binary still lives in `bin/` for reference; it is not used and not shipped in the `.vsix`.
- An unset `UV4.exe` path now produces a clear message instead of a command containing `null`.

## Features

- **Import** a `.uvproj` / `.uvprojx`, or just open the folder that contains it (discovery is recursive, so nested projects are found).
- **Project tree** — target → file group → source, with icons for C, C++, headers, assembler and libraries; files excluded from the build are dimmed and missing files are flagged.
- **Build, rebuild, flash** from three places: the editor title bar, the inline buttons on the target node, and `F7` / `Ctrl+Alt+F7` / `Ctrl+Alt+D`.
- **Streaming output and diagnostics** — `UV4.exe` prints nothing, so the extension reads its `-o` log: it scrolls in the `Keil Assistant` output channel (coloured) and is parsed into Problems panel entries. The terminal stays quiet and no task is created.
- **C/C++ configuration** regenerated per target, including the built-in ARMCC, ARMCLANG and C51 macros.
- **Reference files** for ARM projects, read from the `.d` files after a successful build.
- **Live reload** when the project file changes on disk.

## Requirements

- Windows (uVision is Windows only), Keil uVision 5 or newer (C51 and MDK-ARM)
- VS Code 1.85 or newer

## Settings

| Setting | Meaning |
| --- | --- |
| `KeilAssistant.C51.Uv4Path` | Absolute path of the C51 `UV4.exe` |
| `KeilAssistant.MDK.Uv4Path` | Absolute path of the MDK-ARM `UV4.exe` |
| `KeilAssistant.Project.ExcludeList` | Project file names that are never auto-loaded (compared by file name) |
| `KeilAssistant.Project.FileLocationList` | Extra project paths or globs; `${workspaceFolder}`, `${userHome}` and `${env:NAME}` are expanded |

Both C51 and MDK-ARM projects can point at the same `UV4.exe`. When a path is unset the extension opens the matching setting instead of running a command.

## Usage

1. Set the `UV4.exe` path(s) above.
2. Open the folder that contains the project, or use the "Open keil uVision project" button.
3. With a project loaded, the **build / rebuild / flash** icons appear in the editor title bar.
4. In the "Keil uVision Project" view you can switch the active target, run the same three actions, and expand a source file to see the headers it references (ARM projects, after a successful build).
5. Build output lives in `Output → Keil Assistant`; errors and warnings live in the Problems panel (`Ctrl+Shift+M`).
6. Changing the project in uVision and saving it reloads the tree automatically.

## Generated files

Everything is written below the **workspace root**; the project directory stays clean.

```
<workspace>/
└── .vscode/
    ├── c_cpp_properties.json                # cpptools configuration, one per workspace folder
    └── keil-assistant/
        ├── <projectId>.log                  # what the extension did (load, reload, failures)
        └── <projectId>.build.log            # the `-o` output of the last uVision run
```

The workspace root is the folder that contains the project, otherwise the first
workspace folder, otherwise — when no folder is open — the project directory (with
a one-time warning).

When several projects share a folder, all of their targets end up in the same
`c_cpp_properties.json`; a configuration is prefixed with `<project>/` only if the
target names would collide.

See [docs/behaviour.md](docs/behaviour.md) for the exact list of promises,
invariants and open questions.

## Troubleshooting

**The terminal stays empty.** That is intended: `UV4.exe` writes nothing to a console and the extension does not create tasks. Look at `Output → Keil Assistant` (shown automatically for every build) or the Problems panel.

**The Problems panel is empty after a successful build.** Correct — no errors, no diagnostics. The full log is still in the output channel, and `Open Log` on the project node opens the file.

**A `.bak` file appeared next to `c_cpp_properties.json`.** The original was not valid JSON. The extension backed it up instead of overwriting it, regenerated the file and warned. Fix the original and delete the backup.

**The tree is empty.** Check `KeilAssistant.Project.ExcludeList`, then look for `cannot open …` in the output channel — unreadable or non-uVision files are reported there.

**"UV4.exe not found".** The setting needs the absolute path to `UV4\UV4.exe`, not the directory.

## Project layout

```
src/
├── extension.ts          activation: wiring and command registration only
├── core/                 pure TypeScript: no `vscode`, no direct file system access
│   ├── model.ts          project model (Project / Target / FileGroup / Source)
│   ├── parser.ts         .uvproj(x) XML → model
│   ├── command.ts        UV4 command line and exit-code classification
│   ├── cppconfig.ts      merge strategy for c_cpp_properties.json
│   ├── diagnostics.ts    build log → diagnostics
│   ├── buildlog.ts       build / flash summaries
│   ├── logtail.ts        incremental reading of a log being written
│   ├── outputlog.ts      log line → display level (info / warn / error)
│   ├── deps.ts           .d dependency parsing
│   ├── toolchain.ts      Keil include directories and built-in macros
│   ├── macros.ts         compiler macro tables
│   └── paths.ts          `${...}` variable expansion
└── vscode/               the only layer that imports `vscode`
    ├── projectStore.ts   loading, watching, build state, cpptools sync
    ├── runner.ts         spawn UV4 and stream its log
    ├── status.ts         status bar progress and result
    ├── explorer.ts       tree view (pure rendering of the model)
    ├── workspace.ts      project discovery and workspace root resolution
    ├── artifacts.ts      artifact paths
    ├── config.ts         settings reading and validation
    ├── icons.ts / logger.ts
    └── toolchain.ts      injects the Keil install into the core
```

Two hard rules keep the layering honest: `core/` may not import `vscode` and may
not touch the file system (it is passed in); `vscode/` adapts and does not own
business decisions.

## Development

```bash
pnpm install
pnpm run compile    # tsc -> out/
pnpm run test       # compile and run the unit tests (47)
pnpm run package    # webpack -> dist/extension.js
```

Press `F5` in VS Code to launch the extension host, then open the folder that
contains the Keil project.

Tests only cover `src/core`, because it needs neither VS Code nor Keil: parsing,
command building, config merging, diagnostics, log tailing, macro parsing and
path variables all have cases, with sanitised fixtures in `test/fixtures/`.

## Known limitations

- C51 projects show no reference files (the C51 toolchain emits no `.d` files).
- Project files are read as UTF-8 (a BOM is stripped); GBK-encoded projects may fail to parse.
- Discovery is capped at 100 projects per folder; huge repositories should use `FileLocationList`.
- Only the active target is shown, never several side by side.
- `.uvoptx` (debugger, breakpoints, window layout) is not parsed, so there is no debug integration.

## Provenance and license

- **Upstream:** [github0null/keil-assistant](https://github.com/github0null/keil-assistant) by **cl**, MIT, last released as 1.7.x and no longer maintained.
- **This repository:** a fork of it, starting at version **2.0.0**. `LICENSE` keeps the upstream MIT text and `Copyright (c) 2020 cl`; this fork's changes are released under the same licence.
- **Kept from upstream:** project import and discovery, the Keil project tree, build/rebuild/flash, `c_cpp_properties.json` generation, the `A51` grammar and snippets, the icons, the four `KeilAssistant.*` settings, and the command/view ids.
- **Changed by this fork:** generated files moved from the project directory to the workspace, builds run in-process (no task, no terminal), the output channel is a coloured log channel, the build log is parsed into diagnostics, the code is split into a pure core plus a VS Code layer with 47 unit tests, and `bin/Uv4Caller.exe` is no longer needed at run time.
- **`bin/Uv4Caller.exe`** is the upstream binary, kept for reference only; it is not called and not shipped in the `.vsix`.
- **Issues** should go to this fork's repository — the upstream project is unmaintained.
- **Publishing**: see [docs/publishing.md](docs/publishing.md) for the checklist, including the `publisher` / `repository` fields in `package.json` that still point upstream.

## License

MIT, see [LICENSE](LICENSE).

