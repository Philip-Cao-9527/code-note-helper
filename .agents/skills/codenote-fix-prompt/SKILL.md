---
name: codenote-fix-prompt
description: 为 CodeNote Helper 生成普通开发、修复、验证、治理、文档和审核友好类中文执行 prompt。用于把一次具体任务整理成可直接交给 Codex 或 Agent 执行的 prompt；不承载 Plan mode prompt、code review prompt 或项目 skill creator 的完整职责。
---

# CodeNote Helper 普通任务 Prompt 生成

## 技能定位

本 skill 只生成普通执行 prompt。主产物是一份可复制给 Codex 或 Agent 立刻执行的中文任务 prompt，不直接开始修复，不直接审查代码，也不创建或更新 skill。

以下场景应改用独立 skill：

- 需要先进入 Plan mode、只读探索、提炼 2 到 4 个关键决策点时，使用 `$codenote-plan-mode-prompt`。
- 需要生成 code review 任务 prompt、要求 findings first 和独立审查报告时，使用 `$codenote-code-review-prompt`。
- 需要创建或更新 `.agents/skills` 下的 CodeNote Helper 本地 skill 时，使用 `$codenote-skill-creator`。

只有用户明确要求合并模式时，才在普通执行 prompt 中引用对应原则；不要把这些独立 skill 的完整规则复制进本 skill。

## Skill 交叉引用规则

当生成的 prompt 需要明确要求后续执行者调用其他 skill 时，必须使用 `$skill-name` 形式引用，例如 `$codenote-plan-mode-prompt`。不要只写反引号包裹的 skill 名称，也不要写成普通文件名或自然语言描述。

## 使用流程

1. 确认用户要的是“生成 prompt”，不是直接执行任务。
2. 读取项目材料：
   - `AGENTS.md`
   - 仅当 `AGENTS.override.md` 真实存在时读取它；不存在时不要写成必读事实。
   - `DEVLOG.md`
   - `README.md`
   - 与本轮任务直接相关的真实调用链、测试文件、报告或文档。
3. 读取 `references/prompt-template.md`，按本轮任务裁剪和填充。
4. 输出一份完整、连续、可复制、可执行的中文 prompt。

## 默认补全规则

- 仓库路径默认使用当前 CodeNote Helper 仓库路径；无法确认时要求执行者现场核对。
- 当前版本必须从 `manifest.json`、`popup/popup.html`、`README.md` 现场核对；用户未要求升版时默认保持当前版本。
- 任务涉及功能修复、行为变更、UI 调整、结构调整、测试闭环或版本历史更新时，prompt 应要求同步 `DEVLOG.md` 并新增 `docs/fix-report-vX.Y.Z-YYYYMMDD-主题.md`。
- 任务不触发版本或报告时，prompt 应要求最终总结说明原因。
- 根目录 `references/` 中标注“仅供参考，非项目代码”的内容只能参考，不得要求直接修改；`.agents/skills/*/references/` 属于本地 skill 资产，可按任务目标修改。
- 语言使用简体中文；代码、命令、报错、路径、字段名、域名、专有名词保留原文。

## CodeNote Helper 专属约束

生成 prompt 时，按任务相关性保留下列项目约束：

- Windows 与 UTF-8 编码：修改 JS、HTML、CSS、JSON、Markdown、manifest、README 等文件时保持原文件风格，新建文本默认 UTF-8。
- 最小必要改动：先理解真实入口、调用链、依赖顺序和站点隔离边界，再做修改。
- 版本策略：默认保持当前版本；只有用户明确要求升版时才升级，并同步所有版本位置。
- 文档闭环：按项目规则更新 `DEVLOG.md` 和 `docs/fix-report`，报告链接使用可跳转 Markdown 相对路径。
- 权限与审核友好：涉及 `manifest.json`、权限、host、content scripts、远程请求、README、隐私政策或商店说明时，必须做审核友好自检。
- 禁止无依据保护逻辑：不要凭空加入固定超时、长度截断、条数上限、重试上限、静默兜底或吞异常。
- 用户可见中文文案：按钮、toast、弹窗、错误提示和设置说明必须自然中文，不暴露内部变量、函数名、模块名、堆栈或调试信息。

## 常见任务加料

- 页面抓取、DOM、注入、滚动、点击、浏览器行为：要求先复现，再定位，再修复；默认使用 Playwright MCP 或等价浏览器工具留证据。
- popup、notes、options、shared 数据链路：强调真实状态结构、依赖顺序、脚本注入顺序和防回归测试。
- 题单导入、静态映射：优先内置静态映射；禁止运行时访问 GitHub README 或新增无关远程权限。
- 日志、调试、自动入库、复习链路：日志要可读、克制、结构化，不暴露到用户界面。
- 权限、manifest、远程请求、审核友好：说明为什么必须新增权限或域名、是否可收窄、是否用户触发、是否影响审核。

## 输出包裹规则

- 最终 prompt 必须整体放在一个 Markdown 文本块中，方便复制。
- 如果 prompt 内部包含三反引号，外层使用四反引号或更长围栏。
- 输出代码块前最多写一句中文引导；代码块后不要追加正文。

## 自检

输出前检查：

1. 是否明确这是生成普通执行 prompt，不是直接执行任务。
2. 是否没有把 Plan mode、code review 或 skill creator 的完整规则塞进本 prompt。
3. 如果 prompt 中交叉引用其他 skill，是否统一使用 `$skill-name` 形式。
4. 是否正确处理 `AGENTS.md` 与可选 `AGENTS.override.md`。
5. 是否没有把未验证版本、路径、测试结果或发布状态写成事实。
6. 是否保留 CodeNote Helper 的版本、报告、权限审核、编码、错误处理和用户文案边界。
7. 是否没有要求修改根目录 `references/` 的非项目代码。
8. 是否没有保留空标题、一次性残留或不可执行的模板句。
