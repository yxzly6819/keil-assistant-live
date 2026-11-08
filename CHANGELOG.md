# Change Log

All notable changes to the "keil-assistant" extension will be documented in this file.

## [2.0.0]

This is a fork of [github0null/keil-assistant](https://github.com/github0null/keil-assistant)
(MIT, by cl), which is no longer maintained. Every user-facing feature of 1.7 is
kept and the internals are rewritten.

- **Changed:** `.vscode` is generated in the workspace folder instead of the
  uVision project directory. `c_cpp_properties.json` lives in
  `<workspace>/.vscode`, the per-project logs in
  `<workspace>/.vscode/keil-assistant/`. Nothing is written next to the project
  file, except for the documented fallback when no folder is open.
- **Changed:** `c_cpp_properties.json` is now merged — configurations of other
  tools and unknown fields survive, and the file is no longer rewritten when it
  cannot be parsed (it is backed up to `.bak` first).
- **Changed:** build / rebuild / flash run as a child process inside the
  extension host instead of as VS Code tasks. The `-o` build log streams into the
  `Keil Assistant` output channel while the status bar shows the current action,
  so the terminal stays quiet and repeated builds no longer stack task headers.
- **New:** build / rebuild / flash are also contributed to the editor title bar,
  visible only while a project is loaded.
- **New:** the `Keil Assistant` output channel is a log channel: lines are
  coloured by severity and the panel is shown automatically when a build starts.
- **New:** `Open Log` command, and a `Show Log` action on build failures.
- **New:** unit tests for the parser, command builder, config merge, dependency
  parser, diagnostics parser, log tailing and path variables (`pnpm test`).
- **New:** `docs/behaviour.md`, the behaviour specification.
- **Fixed:** compiler output is finally visible. `UV4.exe` is a GUI program with
  no console output, so the `-o` log is streamed into the output channel and
  parsed into Problems panel entries (path, line, severity, message); download
  results such as `Programming Done. Verify OK.` are reported in a notification.
- **Fixed:** a build that succeeds with warnings (uVision `ERRORLEVEL` 1) is no
  longer reported as a failure; all documented uVision exit codes are mapped to a
  named reason.
- **Fixed:** a missing `UV4.exe` path no longer produces a command containing the
  literal string `null`; the setting is validated first.
- **Fixed:** project files with a UTF-8 BOM are read correctly.
- **Fixed:** a second build of the same project while one is running is refused.
- **Removed:** the `lib/node_utility` copy, `CmdLineHandler`, `ResourceManager`,
  and the `Uv4Caller.exe` dependency at run time (the binary stays in `bin/` for
  reference).
- **Removed:** `activationEvents: ["*"]`; the extension activates on its view,
  its commands, or a workspace containing a project file.
- **Removed:** the contributed `taskDefinitions` and `problemMatchers`. The build
  log is parsed by the extension itself, so the Problems panel has one source of
  truth and no task is involved.

## [v1.7.1]
- Fixed: can't use shortcut key
***

## [v1.7.0]
- Change: adjust view
- Optimize: Update doc
- Optimize: support double click to open file with non-preview mode
***

## [v1.6.2]
- Fixed: output messy code
- Optimize: extend more armcc keywords
***

## [v1.6.1]
- Fixed: error rebuild command
***

## [v1.6.0]
- New: support show source referance files
- New: add exclude list on open multi-project workspace
***

## [v1.5.0]
- New: add 'Active Target' button
- Changed: adjust keybindings
***

## [v1.4.0]
- New: support multi-target keil project
- New: add armclang cpp macros
***

## [v1.3.3]
- Optimize: extend more armcc keywords
***

## [v1.3.2]
- Fixed: some incorrect C51 keywords
- Fixed: some other bugs
***

## [v1.3.1]
- Fixed: add missed system include path
- Changed: remove c51 language highlight
- Optimized: add more system macro
***

## [v1.3.0]
- Add: switch workspace after open project
- Changed: change icon
- Fixed: build failed without workspace
***

## [v1.2.1]
- Add: Add some internal defines for ARM/C51
***

## [v1.2.0]
- Fixed: Can't run task by CMD
- Add: Shortcut keys
***

## [v1.1.0]
- Fixed: Not found C51/STM32 system include dir
- Fixed: Invalid macro
***

## [v1.0.0]
- First release
