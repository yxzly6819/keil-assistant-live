# Keil Assistant

在 VS Code 里打开、浏览、编译、烧录 Keil uVision 5 工程（`.uvproj` / `.uvprojx`）。

配合 [C/C++ 插件](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) 使用：扩展会把 Keil 工程里的头文件路径、宏定义同步进 `c_cpp_properties.json`，让 IntelliSense 与真实编译保持一致。

> 这是对原作者 [github0null/keil-assistant](https://github.com/github0null/keil-assistant) 的一次重构版本（2.0）。原项目已停止更新，本版本保留其全部用户功能，并重写了内部结构。

## 2.0 的变化

- **`.vscode` 生成在工作区目录，而不是 Keil 工程目录**：工程目录不再被写入任何文件。
- 编译/烧录改为 VS Code Task + Problem Matcher，编译结果以 uVision 的退出码为准。
- 源码按「纯核心 / VS Code 适配层」拆分，核心层有单元测试（`npm test`，28 个用例）。
- 移除了随包分发的 `Uv4Caller.exe` 依赖（分析结论见 [docs/behaviour.md](docs/behaviour.md#8-appendix-uv4callerexe)）。
- 未配置 `UV4.exe` 路径时不再拼出 `--uv4Path null` 这样的命令，而是直接提示。

## 功能

- **导入工程**：打开 `.uvproj` / `.uvprojx`，或直接打开工程所在目录自动发现。
- **工程树**：目标（Target）→ 文件分组 → 源文件，图标区分 C / C++ / 头文件 / 汇编 / 库文件，被排除编译的分组和文件会标灰。
- **一键编译、重编译、下载**：`F7` / `Ctrl+Alt+F7` / `Ctrl+Alt+D`。uVision 是 GUI 程序、**不往终端打印任何东西**，所以扩展生成一个小 `.cmd` 包装脚本：跑完 uVision 后把 `-o` 日志回显到任务终端，并用 uVision 的原始退出码退出。同样的日志还会被解析成「问题」面板条目，并汇总到 `Keil Assistant` 输出通道。
- **自动同步 C/C++ 配置**：为每个 Target 生成一份 cpptools 配置，包含 include 路径、宏定义（含 ARMCC / ARMCLANG / C51 的内建宏）。
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
| `KeilAssistant.Project.ExcludeList` | 自动加载时要排除的工程文件名 |
| `KeilAssistant.Project.FileLocationList` | 额外的工程路径或 glob，支持 `${workspaceFolder}` 等变量 |

C51 工程和 ARM 工程可以使用同一个 `UV4.exe`（Keil 的 C51 与 MDK 通常是两个安装目录，按实际填写即可）。

## 用法

1. 设置好上面的 `UV4.exe` 路径。
2. 用 VS Code 打开工程所在目录，或在资源管理器标题栏点击「打开 Keil 工程」。
3. 在「Keil uVision Project」视图里：
   - 点工程上的切换按钮选择 Target；
   - 点 Target 上的三个按钮分别执行 编译 / 重编译 / 下载；
   - 单击源文件预览打开，双击固定标签页；
   - 编译成功后展开源文件，可以看到它引用的头文件。
4. 在 uVision 里增删文件或修改配置，保存后 VS Code 侧自动刷新。

## 生成的文件在哪

全部落在**工作区目录**，工程目录保持干净：

```
<workspace>/
└── .vscode/
    ├── c_cpp_properties.json          # C/C++ 插件的配置（每 workspace folder 一份）
    └── keil-assistant/
        └── <projectId>.log            # 每个工程一份诊断日志
```

工作区目录的判定顺序：

1. 包含该工程的 workspace folder；
2. 否则第一个 workspace folder；
3. 否则（没有打开任何文件夹）回退到工程文件所在目录，并提示一次。

同一工作区里有多个工程时，`c_cpp_properties.json` 会包含所有工程的配置；只有当两个 Target 重名时，配置名才会加上 `<工程名>/` 前缀。

想了解「哪些行为是承诺、哪些还没决定」，见 [docs/behaviour.md](docs/behaviour.md)。

## 项目结构

```
src/
├── extension.ts          激活入口：只做装配与命令注册
├── core/                 纯 TypeScript，不依赖 vscode、不直接读写文件系统
│   ├── model.ts          工程模型（Project / Target / FileGroup / Source）
│   ├── parser.ts         .uvproj(x) XML → 模型
│   ├── command.ts        UV4 命令行与 problem matcher
│   ├── cppconfig.ts      c_cpp_properties.json 的合并策略
│   ├── deps.ts           .d 依赖文件解析
│   ├── toolchain.ts      Keil 头文件目录与内建宏
│   ├── macros.ts         编译器内建宏表
│   └── paths.ts          设置里的变量展开
└── vscode/               唯一 import vscode 的一层
    ├── projectStore.ts   加载、监听、构建状态、cpptools 同步
    ├── explorer.ts       树视图（模型的纯渲染）
    ├── workspace.ts      工程发现与 .vscode 落点
    ├── artifacts.ts      产物路径
    ├── tasks.ts          UV4 的 Task 执行与退出码
    ├── config.ts         设置读取与校验
    ├── icons.ts / logger.ts
    └── toolchain.ts      把 Keil 安装目录注入核心层
```

## 开发

```bash
pnpm install        # 或 npm install
pnpm run compile    # tsc，输出到 out/
pnpm run test       # 编译并运行单元测试
pnpm run package    # webpack 打包到 dist/extension.js
```

调试：用 VS Code 打开本目录，按 `F5`（`Run Extension`）。

测试只覆盖 `src/core`，因为它们不依赖 VS Code 与 Keil：解析、命令行、配置合并、依赖文件解析都有用例，`test/fixtures/` 下是脱敏的工程样本。

## 已知限制

- 不支持 C51 工程的引用展开（Keil 的 C51 工具链不产出 `.d` 文件）。
- 工程文件按 UTF-8 读取（会去掉 BOM），GBK 编码的工程可能解析失败。
- 工作区内工程数量上限为每个目录 100 个，超大仓库建议用 `FileLocationList` 显式指定。

## License

MIT，见 [LICENSE](LICENSE)。
