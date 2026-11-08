# Keil Assistant Live

在 VS Code 里打开、浏览、编译、烧录 Keil uVision 5 工程（`.uvproj` / `.uvprojx`）。

配合 [C/C++ 插件](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) 使用：扩展会把 Keil 工程里的头文件路径、宏定义同步进 `c_cpp_properties.json`，让 IntelliSense 与真实编译保持一致。

> **这是一个独立维护的新扩展（`yxzly6819.keil-assistant-live`，从 1.0.0 开始），基于 [github0null/keil-assistant](https://github.com/github0null/keil-assistant)（作者 cl，MIT 协议）重写。** 上游已停止更新。
>
> ⚠️ **不能与上游的 Keil Assistant 同时安装。** 两者的命令 id（`project.build`…）、视图 id（`project`）和配置键（`KeilAssistant.*`）完全同名，同时启用会互相覆盖；装本扩展前请先卸载上游扩展。
>
> 本版保留了上游的全部用户功能，重写了内部结构，并改变了几项默认行为。详见 [相对上游的改动](#相对上游的改动) 与 [来源与许可](#来源与许可)。

## 相对上游的改动

- **`.vscode` 生成在工作区目录，而不是 Keil 工程目录**：工程目录不再被写入任何文件。
- **编译/烧录不再经过 VS Code Task 和终端**：扩展以子进程运行 `UV4.exe`，把 `-o` 日志实时流进 `Keil Assistant` 输出通道，判定以 uVision 的退出码为准。
- 输出通道是**日志通道**：按级别上色（错误红、警告黄），并自动弹出（不抢焦点）。
- 编译错误与警告解析成「问题」面板条目（带文件、行号）。
- 三个动作同时出现在**编辑器标题栏**、工程树和快捷键里。
- 源码按「纯核心 / VS Code 适配层」拆分，核心层有 47 个单元测试（`pnpm test`）。
- 移除了运行期对 `Uv4Caller.exe` 的依赖（分析结论见 [docs/behaviour.md](docs/behaviour.md#8-appendix-binuv4callerexe)）。二进制仍留在 `bin/` 里作参考，但不参与运行，也不进安装包。
- 未配置 `UV4.exe` 路径时不再拼出 `--uv4Path null` 这样的命令，而是直接提示。

## 功能

- **导入工程**：打开 `.uvproj` / `.uvprojx`，或直接打开工程所在目录自动发现（递归搜索，工程放在子目录里也能找到）。
- **工程树**：目标（Target）→ 文件分组 → 源文件，图标区分 C / C++ / 头文件 / 汇编 / 库文件，被排除编译的分组和文件会标灰，磁盘上缺失的文件带警示图标。
- **一键编译、重编译、下载**：三个入口——编辑器标题栏右上角、工程树里 Target 上的按钮、快捷键 `F7` / `Ctrl+Alt+F7` / `Ctrl+Alt+D`。
- **实时输出 + 问题面板**：uVision 是 GUI 程序、不往终端打印任何东西，所以扩展读它的 `-o` 日志：滚动显示在 `Keil Assistant` 输出通道（带颜色），同时解析成「问题」面板条目。终端保持干净，不创建任务。
- **自动同步 C/C++ 配置**：为每个 Target 生成一份 cpptools 配置，包含 include 路径和宏定义（含 ARMCC / ARMCLANG / C51 的内建宏）。
- **展开引用**：ARM 工程编译成功后，源文件节点可以展开出 `.d` 文件里记录的依赖头文件。
- **工程文件热更新**：在 uVision 里改完工程保存，VS Code 里自动刷新。
- **A51 汇编**语法高亮与代码片段。

## 环境要求

- Windows（uVision 本身只支持 Windows）
- Keil uVision 5 及以上（C51 与 MDK-ARM）
- VS Code 1.85 及以上

## 配置

| 设置项 | 说明 |
| --- | --- |
| `KeilAssistant.C51.Uv4Path` | C51 的 `UV4.exe` 绝对路径，例如 `C:\Keil_v5\UV4\UV4.exe` |
| `KeilAssistant.MDK.Uv4Path` | MDK-ARM 的 `UV4.exe` 绝对路径 |
| `KeilAssistant.Project.ExcludeList` | 自动加载时要排除的工程文件名（按文件名比较） |
| `KeilAssistant.Project.FileLocationList` | 额外的工程路径或 glob，支持 `${workspaceFolder}`、`${userHome}`、`${env:NAME}` |

C51 工程和 ARM 工程可以使用同一个 `UV4.exe`（Keil 的 C51 与 MDK 通常是两个安装目录，按实际填写即可）。未设置时点按钮会直接引导到对应设置项，不会执行任何命令。

## 用法

1. 设置好上面的 `UV4.exe` 路径。
2. 用 VS Code 打开工程所在目录，或在资源管理器标题栏点击「打开 Keil 工程」。
3. 打开一个源文件后，标题栏右上角会出现 **编译 / 重新编译 / 下载** 三个图标（只在加载了工程时出现）。
4. 在「Keil uVision Project」视图里：
   - 点工程上的切换按钮选择 Target；
   - 点 Target 上的三个按钮执行同样的动作；
   - 单击源文件预览打开，双击固定标签页；
   - 编译成功后展开源文件，可以看到它引用的头文件。
5. 构建输出在 `输出 → Keil Assistant`，错误和警告在 `问题`（`Ctrl+Shift+M`）。
6. 在 uVision 里增删文件或修改配置，保存后 VS Code 侧自动刷新。

## 生成的文件在哪

全部落在**工作区目录**，工程目录保持干净：

```
<workspace>/
└── .vscode/
    ├── c_cpp_properties.json                # C/C++ 插件的配置（每 workspace folder 一份）
    └── keil-assistant/
        ├── <projectId>.log                  # 扩展自己的日志（加载、刷新、失败原因）
        └── <projectId>.build.log            # 最近一次 uVision 的 -o 输出（编译器消息）
```

工作区目录的判定顺序：

1. 包含该工程的 workspace folder；
2. 否则第一个 workspace folder（或 `.code-workspace` 所在目录）；
3. 否则（没有打开任何文件夹）回退到工程文件所在目录，并提示一次。

同一工作区里有多个工程时，`c_cpp_properties.json` 会包含所有工程的配置；只有当两个 Target 重名时，配置名才会加上 `<工程名>/` 前缀。

想了解「哪些行为是承诺、哪些还没决定」，见 [docs/behaviour.md](docs/behaviour.md)。

## 常见问题

**终端里没有输出？**
正常。`UV4.exe` 不往控制台写任何东西，我们也不使用 VS Code Task，所以终端保持干净。看 `输出 → Keil Assistant`（每次构建自动弹出）或 `问题` 面板。

**编译通过了，但问题面板是空的？**
这是对的——没有错误/警告就没有诊断。想看完整编译日志，`输出 → Keil Assistant` 里每次构建都有一段，或右键工程节点选 `Open Log`。

**`c_cpp_properties.json` 旁边多了个 `.bak`？**
原文件不是合法 JSON。扩展不会覆盖它，而是先备份、再重新生成，并弹一条警告。修好原文件后删掉 `.bak` 即可。

**工程树是空的？**
先确认 `KeilAssistant.Project.ExcludeList` 没把工程文件名排除掉；再看 `输出 → Keil Assistant` 里 `cannot open …` 的报错（工程文件损坏或不是 uVision 工程时会有明确信息）。

**提示 UV4.exe 不存在？**
设置项里填的是绝对路径，且要指向 `UV4\UV4.exe`（不是 `UV4.exe` 所在目录）。

## 项目结构

```
src/
├── extension.ts          激活入口：只做装配与命令注册
├── core/                 纯 TypeScript，不依赖 vscode、不直接读写文件系统
│   ├── model.ts          工程模型（Project / Target / FileGroup / Source）
│   ├── parser.ts         .uvproj(x) XML → 模型
│   ├── command.ts        UV4 命令行与退出码分级
│   ├── cppconfig.ts      c_cpp_properties.json 的合并策略
│   ├── diagnostics.ts    编译日志 → 诊断
│   ├── buildlog.ts       从日志里提取构建/烧录摘要
│   ├── logtail.ts        增量读取正在写入的日志
│   ├── outputlog.ts      日志行 → 显示级别（info / warn / error）
│   ├── deps.ts           .d 依赖文件解析
│   ├── toolchain.ts      Keil 头文件目录与内建宏
│   ├── macros.ts         编译器内建宏表
│   └── paths.ts          设置里的变量展开
└── vscode/               唯一 import vscode 的一层
    ├── projectStore.ts   加载、监听、构建状态、cpptools 同步
    ├── runner.ts         以子进程运行 UV4 并流式读取日志
    ├── status.ts         状态栏进度与结果
    ├── explorer.ts       树视图（模型的纯渲染）
    ├── workspace.ts      工程发现与 .vscode 落点
    ├── artifacts.ts      产物路径
    ├── config.ts         设置读取与校验
    ├── icons.ts / logger.ts
    └── toolchain.ts      把 Keil 安装目录注入核心层
```

分层的硬性规则只有两条：`core/` 不能 `import vscode`，也不能直接读写文件系统（需要文件系统时通过参数注入）；`vscode/` 只做适配，不承载业务判断。

## 开发

```bash
pnpm install        # 或 npm install
pnpm run compile    # tsc，输出到 out/
pnpm run test       # 编译并运行单元测试（47 个）
pnpm run package    # webpack 打包到 dist/extension.js
```

调试：用 VS Code 打开本目录，按 `F5`（`Run Extension`），然后在弹出的窗口里打开包含 Keil 工程的文件夹。

测试只覆盖 `src/core`，因为它们不依赖 VS Code 与 Keil：工程解析、命令行、配置合并、诊断解析、日志增量读取、宏解析、路径变量都有用例，`test/fixtures/` 下是脱敏的工程样本。

## 已知限制

- 不支持 C51 工程的引用展开（Keil 的 C51 工具链不产出 `.d` 文件）。
- 工程文件按 UTF-8 读取（会去掉 BOM），GBK 编码的工程可能解析失败。
- 工作区内工程数量上限为每个目录 100 个，超大仓库建议用 `FileLocationList` 显式指定。
- 只显示当前 Target，不并列显示多个。
- 不解析 `.uvoptx`（调试器、断点等本机设置），因此不提供调试集成。

## 来源与许可

- **本扩展**：`yxzly6819.keil-assistant-live`，显示名 *Keil Assistant Live*，版本从 **1.0.0** 起，维护者 **yxzly6819**，MIT 协议，仓库 <https://github.com/yxzly6819/keil-assistant-live>。
- **上游**：[github0null/keil-assistant](https://github.com/github0null/keil-assistant)，作者 **cl**，MIT 协议，最后版本 1.7.x，已停止维护。
- **关系**：本扩展是上游代码的**独立重写**，不是上游的官方后续版本。因此 **两者不能同时安装**——命令 id、视图 id、配置键同名（见页首提示）。
- **许可**：`LICENSE` 保留上游版权行 `Copyright (c) 2020 cl`，并追加 `Copyright (c) 2026 yxzly6819`。MIT 要求保留原版权声明，这一点不能省。
- **保留自上游**：工程导入与自动发现、Keil 工程树、编译/重编译/下载、`c_cpp_properties.json` 生成、`A51` 语法与代码片段、图标资源、四个 `KeilAssistant.*` 配置键、命令与视图 id。
- **本版的改动**：生成文件从工程目录移到工作区、构建改为进程内执行（不再用 VS Code Task、不再占用终端）、输出通道按级别上色并自动弹出、编译日志解析成诊断、核心层与 VS Code 层分离并有 47 个单元测试、移除运行期对 `bin/Uv4Caller.exe` 的依赖、编辑器标题栏提供三个入口。
- **`bin/Uv4Caller.exe`**：上游随包分发的二进制，本仓库保留作参考，运行期不调用，也不打进 `.vsix`（见 `.vscodeignore`）。
- **问题反馈**：请提到 [本仓库的 issue](https://github.com/yxzly6819/keil-assistant-live/issues)，上游已停止更新。
- **发布**：打 `.vsix` / 上架前的检查清单见 [docs/publishing.md](docs/publishing.md)。

## License

MIT，见 [LICENSE](LICENSE)。


