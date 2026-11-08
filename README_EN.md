# Keil Assistant

Open, browse, build and flash Keil uVision 5 projects (`.uvproj` / `.uvprojx`) from VS Code.

Use it together with the [C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools): include paths and preprocessor defines from the Keil project are written to `c_cpp_properties.json`, so IntelliSense matches the real compiler.

> Version 2 is a refactor of [github0null/keil-assistant](https://github.com/github0null/keil-assistant). The original project is no longer maintained; this version keeps every user-facing feature and rewrites the internals.

## What changed in 2.0

- **The `.vscode` folder is created in the workspace, not next to the Keil project file.** The project directory is never written to.
- Build / rebuild / flash run as VS Code tasks with problem matchers; success is decided by uVision's exit code.
- The code is split into a pure core and a thin VS Code layer; the core has unit tests (`npm test`, 28 cases).
- The bundled `Uv4Caller.exe` is no longer used (analysis in [docs/behaviour.md](docs/behaviour.md#8-appendix-uv4callerexe)).
- An unset `UV4.exe` path now produces a clear message instead of a command containing `null`.

## Features

- **Import** a `.uvproj` / `.uvprojx`, or just open the folder that contains it.
- **Project tree** — target → file group → source, with icons for C, C++, headers, assembler and libraries; files excluded from the build are dimmed.
- **Build, rebuild, flash** with `F7` / `Ctrl+Alt+F7` / `Ctrl+Alt+D`; compiler output feeds the Problems panel.
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
| `KeilAssistant.Project.ExcludeList` | Project file names that are never auto-loaded |
| `KeilAssistant.Project.FileLocationList` | Extra project paths or globs; `${workspaceFolder}` and friends are expanded |

## Generated files

Everything is written below the **workspace root**; the project directory stays clean.

```
<workspace>/
└── .vscode/
    ├── c_cpp_properties.json          # one per workspace folder
    └── keil-assistant/
        └── <projectId>.log            # one log per project
```

The workspace root is the folder that contains the project, otherwise the first
workspace folder, otherwise — when no folder is open — the project directory (with
a one-time warning).

When several projects share a folder, all of their targets end up in the same
`c_cpp_properties.json`; a configuration is prefixed with `<project>/` only if the
target names would collide.

See [docs/behaviour.md](docs/behaviour.md) for the exact list of promises,
invariants and open questions.

## Development

```bash
pnpm install
pnpm run compile    # tsc -> out/
pnpm run test       # compile and run the unit tests
pnpm run package    # webpack -> dist/extension.js
```

Press `F5` in VS Code to launch the extension host.

## License

MIT, see [LICENSE](LICENSE).
