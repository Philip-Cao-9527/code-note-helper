---
name: codenote-skill-creator
description: 创建或更新 CodeNote Helper 项目本地 `.agents/skills` 下的 Codex skills。用于把高频协作流程、prompt 生成流程、审查流程或项目专项流程沉淀为可复用 skill；不替代一次性任务 prompt、普通开发实现或万能规则汇总。
---

# CodeNote Helper 本地 Skill Creator

## 技能定位

本 skill 服务于 CodeNote Helper 仓库内 `.agents/skills` 的创建和更新。它帮助后续把稳定、可复用、有明确输入输出的协作流程沉淀成本地 skill。

适合沉淀为 skill 的流程：

- 高频出现，读取顺序、边界判断和输出格式相对稳定。
- 有明确触发场景、不适用场景和最终产物。
- 需要专属模板、审查清单、prompt 骨架或项目专项流程。
- 比 `AGENTS.md` 更具体，比一次性 prompt 更可复用。

不适合创建 skill 的情况：

- 只有一次性需求，用 `$codenote-fix-prompt` 生成普通执行 prompt 更合适。
- 只是先计划后执行，用 `$codenote-plan-mode-prompt`。
- 只是生成审查任务 prompt，用 `$codenote-code-review-prompt`。
- 只是普通开发实现，不应包装成长期 skill。
- 想把所有 `AGENTS.md` 规则粗暴塞进单个万能 skill。

## 必读文件

触发本 skill 后，先读取：

1. `AGENTS.md`
2. 仅当 `AGENTS.override.md` 存在时读取它。
3. `DEVLOG.md`
4. `README.md`
5. `.agents/skills` 当前真实结构。
6. 与目标流程直接相关的现有 skill、模板、报告或项目文件。

不要修改根目录 `references/` 的非项目代码；`.agents/skills/*/references/` 属于本地 skill 资产，可在确有用途时创建或修改。

## 命名与结构要求

- skill 名称使用小写字母、数字和连字符。
- 名称避免和系统 skill、插件 skill、`vibe-coding-template` skill 以及 `.agents/skills` 既有名称撞名。
- `SKILL.md` 必须存在，frontmatter 只写必要字段，必须包含 `name` 和 `description`。
- `description` 必须写清用途、触发场景和边界，不写空泛口号。
- `agents/openai.yaml` 只写必要 UI 字段：`display_name`、`short_description`、`default_prompt`。
- `default_prompt` 必须明确包含 `$skill-name`。
- 如果 `SKILL.md`、模板或生成出的 prompt 需要交叉引用其他 skill，必须使用 `$skill-name` 形式；不要只写反引号包裹的 skill 名称。
- `references/` 仅用于较长模板、固定输出骨架、检查清单或示例 prompt。
- `scripts/` 仅用于可重复运行的校验、生成、迁移或格式化脚本；如果创建讲解类 skill，必须复用本 skill 的讲解类专项校验脚本。
- 不创建空目录、空模板、未来可能用得上的占位文件。

## 讲解类 skill 的硬校验

创建或改写技术原理、八股讲解、从零补课、面试口述、项目追问类 skill 时，必须先读取 `$knowledge-explainer` 源模板，再生成目标 skill。

不得削弱 `$knowledge-explainer` 的最高约束、1000 / 3000 字硬门槛、未达字数视为输出失败、输出结构、质量门槛、自检项、公式解释、案例、比喻、记忆抓手和“未实现不能说成已实现”的边界。确实需要裁剪时，必须逐条说明裁剪原因、影响范围和后续补偿方式。

生成后必须运行讲解类专项校验脚本：

```powershell
python -X utf8 .agents/skills/codenote-skill-creator/scripts/validate_knowledge_explainer.py .agents/skills/knowledge-explainer/SKILL.md
```

如果脚本失败，必须继续修改目标 `SKILL.md` 并复跑，直到通过。该脚本只校验结构和关键质量规则是否保留，不判断最终讲解内容是否真的写得好。

## 创建或更新流程

1. 明确目标流程：
   - 谁会使用。
   - 什么时候触发。
   - 不适用于什么场景。
   - 输入信息是什么。
   - 最终产物是什么。
   - 需要读取哪些项目材料。
   - 哪些边界必须禁止。
2. 核对 `.agents/skills` 当前结构和目标名称是否冲突。
3. 读取 `references/skill-template.md`，按 CodeNote Helper 本地语境裁剪。
4. 只创建当前需要的文件：
   - `SKILL.md`
   - 按需创建 `references/具体模板.md`
   - 按需创建 `agents/openai.yaml`
5. 写完后通读所有新增或修改文件，清理占位字段、空标题、一次性任务残留和模板腔废话。
6. 执行结构、UTF-8、frontmatter、引用存在性、YAML 文本结构和 git 范围检查。

## CodeNote Helper 专属边界

创建或更新 skill 时，按需保留这些项目背景：

- 简体中文输出、Windows 与 UTF-8 编码。
- 默认保持当前版本；本地 skill 治理通常不修改 `manifest.json`、popup 版本或 README 版本徽章。
- 涉及协作资产结构调整时，通常需要 `DEVLOG.md` 同版本记录和 docs 修复报告。
- 涉及浏览器扩展运行时代码、权限、远程请求或用户数据时，必须继承 Chrome Web Store 审核友好约束。
- 禁止无依据保护逻辑和吞异常。
- 用户可见文案必须自然中文。

不要把这些规则无差别复制进每个新 skill。只保留目标流程需要的最小上下文，并把较长模板放入 `references/`。

## 验证要求

创建或更新 skill 后，至少验证：

- `rg --files .agents/skills` 核对结构。
- 所有新增或修改的 Markdown / YAML 文件可用 `Get-Content -Encoding UTF8` 读取。
- 每个新增或修改的 `SKILL.md` 有 `name` 和 `description`。
- skill 名称符合小写字母、数字和连字符规则。
- `SKILL.md` 中提到的 `references/`、`agents/openai.yaml` 和模板文件真实存在。
- `agents/openai.yaml` 文本结构包含必要字段；没有 YAML 解析器时说明使用文本结构校验。
- 没有残留空标题、英文占位说明、临时任务句、无用目录或未引用文件。
- 如果创建或改写讲解类 skill，运行 `python -X utf8 .agents/skills/codenote-skill-creator/scripts/validate_knowledge_explainer.py .agents/skills/knowledge-explainer/SKILL.md`，失败时继续修改并复跑。
- `git status --short` 确认没有误改运行时代码、根目录 `references/` 或参考模板目录。

## 自检

输出或交付前检查：

1. 新 skill 是否职责单一、触发清楚、边界明确。
2. 是否没有把一次性任务包装成长期 skill。
3. 是否没有把普通开发、Plan mode、code review 和 skill creator 混成一个万能 skill。
4. 是否没有复制其他项目的私有路径、版本号、测试命令或发布规则。
5. 如果交叉引用其他 skill，是否统一使用 `$skill-name` 形式。
6. 是否所有引用文件真实存在，并通过 UTF-8 读取和基础结构检查。
7. 如果目标是讲解类 skill，是否已通过讲解类专项校验脚本。
