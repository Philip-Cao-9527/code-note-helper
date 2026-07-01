---
name: codenote-plan-mode-prompt
description: 为 CodeNote Helper 生成要求 Codex 使用 Plan mode 的中文 prompt。用于高层设计、架构取向、协作流程、版本边界或风险较高任务，需要先只读探索、提炼 2 到 4 个关键决策点、等待用户选择后再实现；不直接执行计划或修改代码。
---

# CodeNote Helper Plan Mode Prompt 生成

## 技能定位

本 skill 只生成“要求 Codex 使用 Plan mode 的 prompt”。它不进入 Plan mode，不直接给最终实现方案，不替用户拍板，也不修改仓库文件。

适用场景：

- 用户要求先计划、先给选择空间、先不要改代码。
- 任务涉及架构边界、目录归属、长期维护策略、权限审核风险、版本和报告策略。
- 问题反复修复仍未闭环，需要先抽象关键决策，再收敛实现。

不适用场景：

- 普通执行 prompt 使用 `$codenote-fix-prompt`。
- code review prompt 使用 `$codenote-code-review-prompt`。
- 创建或更新本地 skill 使用 `$codenote-skill-creator`。

## Skill 交叉引用规则

如果生成的 Plan mode prompt 需要指向其他 skill，必须使用 `$skill-name` 形式引用，例如 `$codenote-fix-prompt`。不要只写反引号包裹的 skill 名称，也不要把 skill 名称写成普通说明。

## 使用流程

1. 确认用户需要的是 Plan mode prompt，而不是本轮直接进入 Plan mode。
2. 读取项目材料：
   - `AGENTS.md`
   - 仅当 `AGENTS.override.md` 存在时读取它。
   - `DEVLOG.md`
   - `README.md`
   - 与本轮主题相关的项目文件、历史报告或参考模板。
3. 读取 `references/plan-template.md`，按 CodeNote Helper 背景裁剪。
4. 输出一份完整、连续、可复制的中文 Plan mode prompt。

## Prompt 必须表达的规则

最终 prompt 必须要求后续执行者：

- 先使用 Plan mode。
- 只读探索真实仓库、调用链、文档和约束，不直接编辑文件。
- 不要一开始写死完整方案，也不要把细枝末节包装成用户决策。
- 从现场事实中提炼 2 到 4 个关键决策点。
- 每个决策点说明为什么必须现在决策、不同选择影响什么、当前事实倾向是什么、需要用户确认什么。
- 等用户选择后，再收敛文件级计划、验证方式、版本与报告策略、风险和回滚边界。

## CodeNote Helper 专属关注点

根据任务相关性，把下列背景写进 Plan mode prompt：

- CodeNote Helper 是 Chrome MV3 扩展，主线覆盖算法刷题笔记、间隔复习、深度学习复盘和 AI 对话时间轴。
- 默认简体中文、Windows 与 UTF-8 编码。
- 默认保持当前版本；升版必须由用户明确要求并同步版本位置。
- 涉及功能修复、行为变更、UI 调整、结构调整或测试闭环时，通常需要 `DEVLOG.md` 和 docs 修复报告；计划中必须提醒后续报告要通俗可读，Chrome MV3、权限、OAuth / Google Drive / WebDAV、测试工具和 manifest 字段都要配中文解释，不能只堆路径和英文术语。
- 涉及 `manifest.json`、权限、host、content scripts、远程请求、README、隐私政策或商店说明时，必须先评估 Chrome Web Store 审核成本。
- 不要新增无依据的固定超时、截断、上限、重试、静默兜底或吞异常。
- 不要提前把所有规则塞成一个完整实现方案；Plan mode 的重点是先识别少数关键选择。

## 输出包裹规则

- 最终 Plan mode prompt 必须整体放入一个 Markdown 文本块。
- 如果 prompt 内部包含三反引号，外层使用四反引号或更长围栏。
- 输出代码块前最多写一句中文引导；代码块后不要追加正文。

## 自检

输出前检查：

1. 是否明确本 skill 只是生成 Plan mode prompt。
2. 是否要求后续执行者先只读探索，再提炼 2 到 4 个关键决策点。
3. 是否没有替用户拍板或直接给完整实现方案。
4. 是否没有把普通执行、code review 或 skill creator 的完整职责塞进本 prompt。
5. 如果 prompt 中交叉引用其他 skill，是否统一使用 `$skill-name` 形式。
6. 是否保留 CodeNote Helper 的版本、报告、权限审核、编码和用户偏好边界。
