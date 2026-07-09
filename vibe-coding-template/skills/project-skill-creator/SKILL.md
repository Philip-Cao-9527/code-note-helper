---
name: project-skill-creator
description: 基于用户需求和项目真实上下文创建或更新项目本地 skill。用于把高频协作流程、领域任务、项目规范、prompt 生成流程或审查流程沉淀为可复用 skill，并避免把一次性任务误做成长期 skill。
---

# project-skill-creator

## 技能定位

创建或更新项目本地 skill。它面向“后续会反复出现、输入输出稳定、边界清晰”的流程，不用于一次性任务总结，也不替代具体业务实现。

这个 skill 负责 skill 结构、触发条件、必读材料、模板引用、质量标准和验证方式。它不应该把项目全部规范粗暴塞进单个 skill，也不应该把一次性 prompt 包装成长期能力。

## 什么时候应该创建新 skill

适合创建新 skill 的情况：

- 某类任务会反复出现，并且每次都需要相似的读取顺序、边界判断和输出格式。
- 任务有清晰触发词、适用场景和不适用场景。
- 任务需要引用专属模板、固定检查清单、示例输出或脚本。
- 任务与项目规则相关，但比 `AGENTS.md` 更具体、更偏流程。
- 用户明确希望把流程沉淀为后续可调用的本地 skill。

不适合创建新 skill 的情况：

- 只有一次性需求，用普通 prompt 更合适。
- 需求还没稳定，关键输入、输出和边界都在变化。
- 只是几条项目长期规则，应写进 `AGENTS.md`。
- 只是一次开发、修复或文档任务，应交给 `$project-prompt-creator`。
- 只是先计划后执行，应交给 `$plan-mode-planner`。
- 只是 code review，应交给 `$code-reviewer`。
- 想把所有规范都塞进一个万能 skill，导致职责混乱。

## 与其他规则资产的边界

- `AGENTS.md`：放长期、全项目生效的底线规则，如语言、编码、测试、版本、报告、错误处理和不可做事项。
- `$project-prompt-creator`：生成一次具体任务的执行 prompt，不沉淀长期流程。
- `$plan-mode-planner`：生成要求 Plan mode 先决策后执行的 prompt。
- `$code-reviewer`：生成审查任务 prompt，不承担通用开发任务。
- `$web-search`：提供通用联网检索、外部依据分层和最新事实核对；创建检索类 skill 时可参考它的触发规则、来源优先级和输出结构。
- `$knowledge-explainer`：提供通用技术原理、八股讲解、从零教学和项目追问回答；创建领域讲解类 skill 时可参考它的强质量门槛、双层讲解结构和未实现能力边界。
- 新 skill：承载某个高频流程的专属读取顺序、模板、输出格式和验证要求。

## 讲解类 skill 的硬校验

创建或改写技术原理、八股讲解、从零教学、面试口述、项目追问类 skill 时，必须先读取 `$knowledge-explainer` 源模板，再生成目标 skill。

不得削弱 `$knowledge-explainer` 的最高约束、1000 / 3000 字硬门槛、未达字数视为输出失败、输出结构、质量门槛、自检项和“未实现不能说成已实现”的边界。确实需要裁剪时，必须逐条说明裁剪原因、影响范围和后续补偿方式。

生成后必须运行讲解类专项校验脚本：

```powershell
python -X utf8 vibe-coding-template/skills/knowledge-explainer/scripts/validate_knowledge_explainer.py path/to/knowledge-explainer/SKILL.md
```

如果脚本失败，必须继续修改目标 `SKILL.md` 并复跑，直到通过。该脚本只校验结构和关键质量规则是否保留，不判断最终讲解内容是否真的写得好。

## 使用流程

1. 明确用户想沉淀的流程：
   - 谁会使用。
   - 什么时候触发。
   - 不适用于什么场景。
   - 需要读取哪些项目材料。
   - 输入信息是什么。
   - 最终产物是什么。
   - 哪些边界必须禁止。
2. 读取目标项目的 `AGENTS.md` 或同类规则文件，以及与该流程直接相关的项目材料。
3. 读取 `references/skill-template.md`，按目标流程生成或更新 skill。
4. 为新 skill 选择不会与系统 skill、插件 skill 或已有项目 skill 冲突的名称。
5. 只创建必要文件：
   - `SKILL.md` 必须有。
   - `agents/openai.yaml` 仅在项目使用该元数据入口时创建。
   - `references/` 仅在需要专属模板、较长检查清单或示例输出时创建。
   - `scripts/` 仅在需要可复用自动化脚本时创建。
   - `templates/` 仅在需要复制型文件模板时创建。
   - `assets/` 仅在需要图片、示例数据、静态资源时创建。
   - 不创建空目录、空模板或未来可能用得上的占位文件。

## 命名要求

- 使用小写字母、数字和连字符。
- 不使用 `skill-creator` 这类容易和系统 skill 冲突的名称。
- 名称应表达动作和对象，例如 `project-prompt-creator`、`code-reviewer`。
- 如果项目已有命名风格，优先沿用项目风格。

## 输出要求

- 生成完整 skill 文件内容或补丁方案。
- `SKILL.md` frontmatter 必须包含 `name` 和 `description`。
- `description` 要写清用途、触发场景和边界，不写空泛口号。
- `SKILL.md` 必须说明何时读取 `references/`、何时运行 `scripts/`、何时使用 `templates/` 或 `assets/`。
- 如果 `SKILL.md`、模板或生成出的 prompt 需要交叉引用其他 skill，必须使用 `$skill-name` 形式；不要只写反引号包裹的 skill 名称。
- 如果创建 `agents/openai.yaml`，只写必要 UI 字段并保证 YAML 可解析。

## 验证要求

创建或更新 skill 后，至少验证：

- `SKILL.md` frontmatter 可解析，字段必要且不重复。
- skill 名称符合命名要求。
- `agents/openai.yaml` 可解析。
- `references/`、`scripts/`、`templates/`、`assets/` 中被引用的文件真实存在。
- 所有新增或修改的中文 Markdown / YAML 文件 UTF-8 可读。
- 没有保留英文占位说明、空标题、项目私有硬编码或一次性任务残留。

## 自检

输出前逐条检查：

1. 这个流程是否真的值得沉淀成 skill，而不是一次性 prompt。
2. 新 skill 是否职责单一、触发清楚、边界明确。
3. 是否没有把多个无关行为模式堆进一个 skill。
4. 是否没有复制旧项目私有路径、模块名、版本号、测试命令或发布规则。
5. 如果交叉引用其他 skill，是否统一使用 `$skill-name` 形式。
6. 是否避免和系统 skill、插件 skill 或项目已有 skill 撞名。
7. 是否设计了可执行的结构校验、YAML 校验和 UTF-8 读取校验。
