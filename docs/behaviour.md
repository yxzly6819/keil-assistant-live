# Behaviour specification

This is the one page that says what version 2 of Keil Assistant promises, what it
refuses to do, and what is still undecided. Everything here is meant to be
checkable against the code; if it drifts, the document is wrong.

## 1. Purpose

Keil Assistant lets you treat a Keil uVision 5 project as a VS Code project:

- **import** a `.uvproj` (C51) or `.uvprojx` (MDK-ARM) file,
- **show** its targets, file groups and sources as a tree that mirrors uVision,
- **build, rebuild and flash** it with one click (F7 / Ctrl+Alt+F7 / Ctrl+Alt+D),
- **keep `c_cpp_properties.json` up to date** so IntelliSense sees the same
  include paths and defines as the compiler.

## 2. Non-goals

- It is not a replacement for the uVision IDE: project settings are still edited
  in uVision, and a saved .uvproj/.uvprojx file is the only source of truth.
- It does not implement Keil's C51 code generation, device database or packs.
- It is Windows only (Keil uVision itself is).
- C51 dependency expansion (`.d` files) is not implemented; only ARM projects
  show reference files.

## 3. Where files are written

Nothing is created inside the uVision project directory. All generated files live
in the *workspace root*:

| File | Location | Why |
| --- | --- | --- |
| cpptools configuration | `<workspace>/.vscode/c_cpp_properties.json` | cpptools only reads it from the folder's `.vscode` |
| Diagnostics log | `<workspace>/.vscode/keil-assistant/<projectId>.log` | one file per project, so multi-project workspaces do not interleave |

`<workspace>` is resolved in this order:

1. the workspace folder that contains the project file;
2. otherwise the first workspace folder (or the folder holding the `.code-workspace` file);
3. otherwise the directory of the project file, with a one-time warning.

## 4. Decided behaviour

| # | Behaviour |
| --- | --- |
| B1 | Projects are opened explicitly (`Open keil uVision project`) or discovered automatically: every `*.uvproj`/`*.uvprojx` in the workspace, plus `KeilAssistant.Project.FileLocationList` entries (paths or globs). |
| B2 | Files whose base name is in `KeilAssistant.Project.ExcludeList` are never auto-loaded. |
| B3 | The project file is watched; a change reloads the model after a 300 ms quiet period. While uVision holds its own lock, the reload retries every 500 ms. |
| B4 | A project file that cannot be parsed produces a named error (`ProjectFormatError`) and leaves the previously loaded model untouched. |
| B5 | Build/Rebuild/Download run `UV4.exe` as a VS Code task. Because `UV4.exe` is a GUI program that prints nothing to a console, `-o <build log>` is passed and the log is parsed: compiler errors and warnings become entries in the Problems panel. |
| B6 | Success is decided by uVision's `ERRORLEVEL`: `0` and `1` (warnings) are success, everything else is failure with a named reason. The log records the command, the code and the verdict. |
| B7 | After a successful ARM build the `.d` files in the target output directory refresh the "references" children of each source. |
| B8 | `c_cpp_properties.json` receives one configuration per Keil target. The name is the target name, prefixed with `<project>/` only when two targets would collide. |
| B9 | Configurations and fields the extension does not own are preserved byte-for-byte in meaning (JSON is re-serialised with 4-space indentation). |
| B10 | The tree shows the active target only; `Switch Target` changes which one. |
| B11 | A second build request for the same project while one is running is refused with a message. |
| B12 | Compiler output goes to the output channel `Keil Assistant`, to `<workspace>/.vscode/keil-assistant/<projectId>.build.log`, and to the Problems panel. Build failures offer `Show Log`, which opens that file. |

## 5. Invariants (things the code must never do)

- **I1** Never write into the uVision project directory — except for the
  documented fallback when the window has no folder open.
- **I2** Never rewrite a `c_cpp_properties.json` that cannot be parsed: back it up
  to `.bak`, regenerate, and warn. A failed write must not destroy user data.
- **I3** Never invoke `UV4.exe` when the configured path is missing or does not
  exist; report the setting instead of running a command containing `null`.
- **I4** Never run two builds of the same project at the same time.
- **I5** Never overwrite an existing `.bak` file.
- **I6** Never report a build with warnings (exit code 1) as failed, and never
  report a failed build as success.

## 6. Undecided (do not treat as a promise)

- Whether a failed build should still refresh the reference lists.
- What to do when two projects define the same target name *and* the same project
  name (configuration names collide).
- Discovery limits: at most 100 matches per folder; huge monorepos may need an
  explicit `FileLocationList`.
- Behaviour in a window without any folder: the extension works, but this is a
  fallback, not a supported workflow.
- Build cancellation and timeouts.
- Correct handling of non-UTF-8 (e.g. GBK) project files: a BOM is stripped, but
  the file is otherwise assumed to be UTF-8.

## 7. External contracts

**uVision command line**

```
UV4.exe -b|-r|-f <project> -j0 -t <target> -o <build log>
```

`-b` build, `-r` rebuild, `-f` flash, `-j0` non-interactive, `-t` target.
`-o` is not optional: `UV4.exe` has no console output, so the log file is the
only source of compiler messages.

**Compiler messages** are parsed from that log (`path(line): error: message`,
optionally several messages on one line, plus the GCC `path:line:col:` form).
The terminal is intentionally ignored as a source of build output.

**Exit code** is uVision's documented `ERRORLEVEL`, which is the only signal the
extension uses to decide the verdict:

| Code | Meaning | Verdict |
| --- | --- | --- |
| 0 | no errors or warnings | success |
| 1 | warnings | success (a warning message is shown) |
| 2 | errors | failure |
| 3 | fatal error | failure |
| 11 | project file could not be opened for writing | failure |
| 12 | device not found in the device database | failure |
| 13 | error writing the project file | failure |
| 15 | error reading an imported XML file | failure |
| 20 | project could not be converted | failure |
| other | unknown | failure, reported with the raw code |

**`.d` dependency files** — both armcc and armclang shapes are accepted:

```
.\Objects\main.o: ..\Core\Src\main.c .\Core\Inc\main.h      (armcc)
.\Objects\main.o: ..\Core\Src\main.c \                      (armclang)
 .\Core\Inc\main.h
```

A backslash escapes a space only; otherwise it is a path separator.

**`c_cpp_properties.json`** — the extension only writes the `name`,
`includePath`, `defines` and `intelliSenseMode` keys of its own configurations.

## 8. Appendix: `bin/Uv4Caller.exe`

Version 1 shipped a .NET helper that called `UV4.exe`. Reading its IL shows the
whole program: parse `--uv4Path/--prjPath/--targetName/-c` into a dictionary,
substitute `${...}` in the `-c` template, then call msvcrt's `system()` — which
runs the command through `cmd.exe` and returns its exit status.

That is exactly what a VS Code `ShellExecution` does, so the helper is no longer
used. The file is kept in the repository as a reference for the original
behaviour, not as part of the running product.
