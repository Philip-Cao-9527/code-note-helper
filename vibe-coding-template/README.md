# vibe-coding-template

把一个新项目带进稳定协作状态，最难的往往不是写第一段代码，而是把规则、边界、证据和交付习惯说清楚。`vibe-coding-template` 提供一组本地 skill 模板，用来快速搭起这套项目工作流：项目规则怎么写、一次任务 prompt 怎么组织、什么时候先让 Codex 进入 Plan mode、怎么发起 code review、什么时候把流程沉淀成新的项目 skill，以及什么时候需要联网取证或先补齐技术原理。



## 适合什么时候用

- 初始化新项目时，需要生成或整理项目级 `AGENTS.md`。
- 某类任务反复出现，值得沉淀成项目本地 skill。
- 想把一段需求整理成可直接交给 Codex/Agent 执行的 prompt。
- 任务存在方向选择，需要先让 Codex 进入 Plan mode，读仓库后再提炼关键决策。
- 想发起一次代码审查，但不希望审查 prompt 变成实现任务。
- 代码生成、技术选型、方案设计或技术解释依赖最新外部依据。
- 用户缺少领域背景，需要先把技术原理、八股表达或项目追问讲透。

## 七个内置 skill

| skill | 用途 |
| --- | --- |
| `$agents-md-creator` | 生成或更新项目级 `AGENTS.md`，沉淀长期生效的语言、编码、测试、版本、报告、风险和交付规则。 |
| `$project-skill-creator` | 创建项目本地 skill，把高频、稳定、可复用的协作流程变成长期工具。 |
| `$project-prompt-creator` | 在项目约束下生成一次具体任务的可执行 prompt，适合开发、修复、文档、验证、治理和交接任务。 |
| `$plan-mode-planner` | 生成要求 Codex 先使用 Plan mode 的 prompt，用于先读仓库、提炼关键决策、用户拍板后再执行的任务。 |
| `$code-reviewer` | 生成 code review prompt，默认只要求审查报告和建议，不直接修改代码。 |
| `$web-search` | 为联网检索、官方文档、论文、仓库、标准、数据集、benchmark、release notes、技术选型和最新工程实践提供可追溯外部依据。 |
| `$knowledge-explainer` | 生成技术原理、八股讲解、从零教学、面试口述和项目追问回答；涉及最新外部依据时应先调用 `$web-search`。 |

## skill 边界

- `$project-prompt-creator` 负责把一次具体任务组织成可执行 prompt；如果 prompt 的后续执行依赖外部最新知识，应在 prompt 中要求执行者调用 `$web-search`。
- `$plan-mode-planner` 负责先决策后执行的 prompt，不替用户拍板，也不承担长篇原理教学。
- `$code-reviewer` 负责生成审查 prompt，默认只要求报告和建议，不直接修复。
- `$project-skill-creator` 负责创建新的项目本地 skill；如果要创建检索类或领域讲解类 skill，可以参考 `$web-search` 和 `$knowledge-explainer` 的结构。
- `$web-search` 只负责外部依据检索、来源分层和工程落点，不负责长篇教学；需要讲透概念时交给 `$knowledge-explainer`。
- `$knowledge-explainer` 负责讲解、口述和项目追问，不直接修改代码；涉及最新论文、官方文档、benchmark、争议结论或现代 API 时，先调用 `$web-search`。
- `$knowledge-explainer` 属于强约束模板。开源用户用 `$project-skill-creator` 生成自己项目的讲解类 skill 后，应运行 `python -X utf8 vibe-coding-template/skills/project-skill-creator/scripts/validate_knowledge_explainer.py path/to/knowledge-explainer/SKILL.md`，确认最高约束、字数门槛、输出结构、质量门槛和自检项没有被削弱。README 只保留入口说明，完整规则以 `$knowledge-explainer` 和 `$project-skill-creator` 为准。

## knowledge-explainer 如何避免生成跑偏

`$knowledge-explainer` 和普通 skill 模板不一样，它不是只给一个松散写作风格，而是带有强质量门槛的讲解类模板。它要解决的问题是：后续用 `$project-skill-creator` 生成项目自己的讲解类 skill 时，Agent 可能为了“模板化”或“简化”把最关键的规则删掉，比如 1000 / 3000 字硬门槛、未达字数视为输出失败、固定输出结构、公式解释、案例、比喻、记忆抓手、自检项和未实现能力边界。

为避免这种跑偏，模板包用四层机制约束：

1. 源模板保留承重规则：[skills/knowledge-explainer/SKILL.md](skills/knowledge-explainer/SKILL.md) 明确写入 `## 最高约束`、`可直接口述回答（快速复习总结，>=1000字）`、`详细原理讲解（通俗版，>=3000字，含公式）`、`## 质量门槛`、`## 自检` 和“不能把未实现能力说成已经完成”的边界。后续项目可以改项目背景，但不应该削弱这些讲解质量规则。
2. 生成器先读源模板：[skills/project-skill-creator/SKILL.md](skills/project-skill-creator/SKILL.md) 要求创建或改写讲解类 skill 时必须先读取 `$knowledge-explainer` 源模板，并明确不得削弱最高约束、字数门槛、输出失败规则、输出结构、质量门槛和自检项。
3. 参考模板传递规则：[skills/project-skill-creator/references/skill-template.md](skills/project-skill-creator/references/skill-template.md) 单独提供“讲解类 skill 专项校验”段落。这样开源用户先用 `$project-skill-creator` 生成自己的项目级 skill creator，再由那个 skill creator 继续生成项目内讲解类 skill 时，也能继续携带这条规则。
4. 脚本硬失败兜底：[skills/project-skill-creator/scripts/validate_knowledge_explainer.py](skills/project-skill-creator/scripts/validate_knowledge_explainer.py) 会检查目标 `SKILL.md` 是否保留 frontmatter、最高约束、1000 / 3000 字硬门槛、输出失败规则、输出结构、质量门槛、自检项、公式 / 案例 / 比喻 / 记忆要求、未实现能力边界和 `$web-search` 联动。缺少关键项时返回非 0，并逐条列出缺失项。

推荐使用闭环：

```powershell
python -X utf8 vibe-coding-template/skills/project-skill-creator/scripts/validate_knowledge_explainer.py path/to/knowledge-explainer/SKILL.md
```

如果脚本失败，不要把失败当成“建议项”，而是继续修改目标 `SKILL.md` 并复跑，直到通过。这个脚本只保证关键结构和质量规则没有丢失，不判断最终讲解内容是否真的写得好；真实讲解质量仍需要人工通读或用具体讲解任务检验。

## 强约束模板如何校验

模板包里有三类内容最容易在复制、裁剪和二次生成时跑偏：项目级 `AGENTS.md`、一次性执行 prompt、长篇知识讲解。它们都带有“不能丢”的承重规则，所以不只靠 README 提醒，而是配了专项脚本做硬校验。

| 模板 | 防跑偏重点 | 校验命令 |
| --- | --- | --- |
| `$agents-md-creator` | 执行环境、编码、修改前必读、版本规则、修复报告规则、无依据保护逻辑、错误处理、测试验证、输出验收、进度播报 | `python -X utf8 vibe-coding-template/skills/agents-md-creator/scripts/validate_agents_md.py path/to/AGENTS.md` |
| `$project-prompt-creator` | 硬性前置要求、项目边界、版本与报告策略、TODO 分块、实现约束、测试验证、交付物顺序、Markdown 文本块包裹 | `python -X utf8 vibe-coding-template/skills/project-prompt-creator/scripts/validate_project_prompt.py path/to/generated-prompt.md` |
| `$knowledge-explainer` | 最高约束、1000 / 3000 字门槛、输出失败规则、讲解结构、质量门槛、自检项、未实现能力边界、`$web-search` 联动 | `python -X utf8 vibe-coding-template/skills/project-skill-creator/scripts/validate_knowledge_explainer.py path/to/knowledge-explainer/SKILL.md` |

这些脚本检查的是结构和关键质量规则，不替代人工判断。它们的价值是先挡住明显跑偏：比如把 `AGENTS.md` 的进度播报格式删掉，把 prompt 的验证要求改成泛泛一句“测试一下”，或者把讲解类 skill 的 1000 / 3000 字硬门槛改成“适当展开”。脚本失败时，按缺失项继续修改并复跑；脚本通过后，再通读内容，确认项目事实、路径、版本、测试命令和报告规则都来自目标项目本身。

## 推荐使用顺序

1. 新项目先用 `$agents-md-creator` 生成项目级 `AGENTS.md`。
2. 项目跑起来后，用 `$project-prompt-creator` 组织具体任务。
3. 遇到方向不清、风险较高或需要用户选择的任务，用 `$plan-mode-planner` 生成 Plan mode prompt。
4. 需要审查 diff、PR、指定文件或发布风险时，用 `$code-reviewer` 生成审查 prompt。
5. 任务依赖最新外部事实时，用 `$web-search` 先取证，再进入实现、讲解或审查。
6. 用户需要先理解领域知识、面试口述或项目追问时，用 `$knowledge-explainer`，必要时先让它调用 `$web-search`。
7. 当某个流程反复出现、输入输出稳定、边界清楚时，再用 `$project-skill-creator` 创建新的项目本地 skill。

## 目录结构

```text
vibe-coding-template/
├── README.md
└── skills/
    ├── agents-md-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── agents-template.md
    │   └── scripts/
    │       └── validate_agents_md.py
    ├── project-skill-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── skill-template.md
    │   └── scripts/
    │       └── validate_knowledge_explainer.py
    ├── project-prompt-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── prompt-template.md
    │   └── scripts/
    │       └── validate_project_prompt.py
    ├── plan-mode-planner/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── plan-template.md
    ├── code-reviewer/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── review-template.md
    ├── web-search/
    │   ├── SKILL.md
    │   └── agents/
    │       └── openai.yaml
    └── knowledge-explainer/
        ├── SKILL.md
        └── agents/
            └── openai.yaml
```

## 复制到新项目后怎么改

先读新项目的 README、现有规则、测试入口、发布方式和关键目录，再改模板。不要先把旧项目的约束一股脑贴进去。

建议按这个顺序裁剪：

1. 替换所有 `{{...}}` 占位符，写入新项目真实路径、项目类型、版本文件、测试命令和报告目录。
2. 删除不适用的条件段。可选示例包括 UI 审核、数据迁移、真实服务验证、人工登录验证等；这些示例不代表模板默认绑定某类项目。
3. 把项目长期规则放进 `AGENTS.md`，把一次性任务要求放进 prompt，把高频稳定流程放进 skill。
4. 保留可以检查的要求，删除空标题、空口号和无法执行的泛泛描述。
5. 校验 `SKILL.md` frontmatter、`agents/openai.yaml`、中文 UTF-8 可读性和引用文件存在性。
