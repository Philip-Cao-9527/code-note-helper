# vibe-coding-template

把一个新项目带进稳定协作状态，最难的往往不是写第一段代码，而是把规则、边界、证据和交付习惯说清楚。`vibe-coding-template` 提供一组本地 skill 模板，用来快速搭起这套项目工作流：项目规则怎么写、一次任务 prompt 怎么组织、什么时候先让 Codex 进入 Plan mode、怎么发起 code review、什么时候把流程沉淀成新的项目 skill。



## 适合什么时候用

- 初始化新项目时，需要生成或整理项目级 `AGENTS.md`。
- 某类任务反复出现，值得沉淀成项目本地 skill。
- 想把一段需求整理成可直接交给 Codex/Agent 执行的 prompt。
- 任务存在方向选择，需要先让 Codex 进入 Plan mode，读仓库后再提炼关键决策。
- 想发起一次代码审查，但不希望审查 prompt 变成实现任务。

## 五个内置 skill

| skill | 用途 |
| --- | --- |
| `agents-md-creator` | 生成或更新项目级 `AGENTS.md`，沉淀长期生效的语言、编码、测试、版本、报告、风险和交付规则。 |
| `project-skill-creator` | 创建项目本地 skill，把高频、稳定、可复用的协作流程变成长期工具。 |
| `project-prompt-creator` | 在项目约束下生成一次具体任务的可执行 prompt，适合开发、修复、文档、验证、治理和交接任务。 |
| `plan-mode-planner` | 生成要求 Codex 先使用 Plan mode 的 prompt，用于先读仓库、提炼关键决策、用户拍板后再执行的任务。 |
| `code-reviewer` | 生成 code review prompt，默认只要求审查报告和建议，不直接修改代码。 |

## 推荐使用顺序

1. 新项目先用 `agents-md-creator` 生成项目级 `AGENTS.md`。
2. 项目跑起来后，用 `project-prompt-creator` 组织具体任务。
3. 遇到方向不清、风险较高或需要用户选择的任务，用 `plan-mode-planner` 生成 Plan mode prompt。
4. 需要审查 diff、PR、指定文件或发布风险时，用 `code-reviewer` 生成审查 prompt。
5. 当某个流程反复出现、输入输出稳定、边界清楚时，再用 `project-skill-creator` 创建新的项目本地 skill。

## 目录结构

```text
vibe-coding-template/
├── README.md
└── skills/
    ├── agents-md-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── agents-template.md
    ├── project-skill-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── skill-template.md
    ├── project-prompt-creator/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── prompt-template.md
    ├── plan-mode-planner/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── plan-template.md
    └── code-reviewer/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        └── references/
            └── review-template.md
```

## 复制到新项目后怎么改

先读新项目的 README、现有规则、测试入口、发布方式和关键目录，再改模板。不要先把旧项目的约束一股脑贴进去。

建议按这个顺序裁剪：

1. 替换所有 `{{...}}` 占位符，写入新项目真实路径、项目类型、版本文件、测试命令和报告目录。
2. 删除不适用的条件段。可选示例包括 UI 审核、数据迁移、真实服务验证、人工登录验证等；这些示例不代表模板默认绑定某类项目。
3. 把项目长期规则放进 `AGENTS.md`，把一次性任务要求放进 prompt，把高频稳定流程放进 skill。
4. 保留可以检查的要求，删除空标题、空口号和无法执行的泛泛描述。
5. 校验 `SKILL.md` frontmatter、`agents/openai.yaml`、中文 UTF-8 可读性和引用文件存在性。
