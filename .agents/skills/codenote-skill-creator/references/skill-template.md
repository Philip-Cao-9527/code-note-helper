# CodeNote Helper 本地 Skill 模板

本文件是 `codenote-skill-creator` 的专属参考模板。创建具体 skill 时，用真实名称、职责和文件路径替换尖括号字段；删除不适用段落，不保留空标题。

## 推荐目录

按需创建，禁止空壳堆积。

```text
<skill-name>/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   └── <template-name>.md
└── scripts/
    └── <script-name>
```

最小结构只需要：

```text
<skill-name>/
└── SKILL.md
```

## SKILL.md 模板

```markdown
---
name: <skill-name>
description: <说明这个 skill 做什么、什么时候触发、适合哪些任务，以及不适合什么边界。>
---

# <中文标题>

## 技能定位

主职责：<唯一主职责>。

适用场景：

- <适用场景>

不适用场景：

- <不适用场景>

最终产物：<最终产物>。

## 必读文件

触发本 skill 后，先读取：

1. `AGENTS.md`
2. 仅当 `AGENTS.override.md` 存在时读取它。
3. `DEVLOG.md`
4. `README.md`
5. `<流程相关文件>`
6. `<references 文件，可删除>`

不要无目标扫描整个仓库；只读取与本轮任务直接相关的材料。

## 使用流程

1. 确认用户目标和本 skill 是否适用。
2. 读取项目规则和必读文件。
3. 按目标流程整理输入、边界和产物。
4. 必要时读取 `references/<template-name>.md`。
5. 生成最终产物或补丁方案。

## Skill 交叉引用

如果本 skill 需要引用其他 skill，必须使用 `$skill-name` 形式，例如 `$codenote-fix-prompt`。不要只写反引号包裹的 skill 名称，也不要写成普通文件名。

## 讲解类 skill 专项校验

当目标 skill 属于技术原理、八股讲解、从零补课、面试口述或项目追问类时，必须先读取 `$knowledge-explainer` 源模板，并保留其中的最高约束、1000 / 3000 字硬门槛、未达字数视为输出失败、输出结构、质量门槛、自检项、公式解释、案例、比喻、记忆抓手和未实现能力边界。

生成目标 `SKILL.md` 后运行：

```powershell
python -X utf8 .agents/skills/codenote-skill-creator/scripts/validate_knowledge_explainer.py .agents/skills/knowledge-explainer/SKILL.md
```

脚本返回非 0 时，继续修改目标 `SKILL.md` 并复跑，直到通过。这个脚本只校验结构和关键质量规则是否保留，不判断最终讲解内容是否真的写得好。

## 输出格式

最终输出必须包含：

1. 文件或产物清单。
2. 关键判断和边界。
3. 实际验证方式。
4. 风险与未验证项。
5. 最终结论。

如果最终产物是 prompt，必须整体放入一个 Markdown 文本块；如果内部包含三反引号，外层使用四反引号或更长围栏。

如果最终产物包含报告、审查结果或证据索引，文件链接必须优先使用可跳转 Markdown 相对路径，链接优先落到具体文件名，能定位到行号时写到行号。

## 质量标准

- 产物必须具体、可检查、可落地。
- 不保留空标题、空占位字段、英文占位说明或一次性任务残留。
- 不把其他项目的私有路径、模块名、版本号、测试命令或发布规则写成当前项目事实。
- 交叉引用其他 skill 时必须使用 `$skill-name` 形式。
- 不新增没有依据的保护逻辑。
- 不把未验证写成已验证。

## 验证方式

- 结构检查：`rg --files .agents/skills`
- UTF-8 可读性：`Get-Content -Encoding UTF8 <文件路径>`
- frontmatter 检查：确认 `SKILL.md` 存在 `name` 和 `description`
- 引用存在性检查：确认 `references/` 和 `agents/openai.yaml` 中被引用的文件真实存在
- 讲解类专项校验：`python -X utf8 .agents/skills/codenote-skill-creator/scripts/validate_knowledge_explainer.py .agents/skills/knowledge-explainer/SKILL.md`
- git 范围检查：`git status --short`
```

## openai.yaml 模板

```yaml
interface:
  display_name: "CodeNote 中文显示名"
  short_description: "说明这个 skill 的主要用途"
  default_prompt: "使用 $skill-name 完成 CodeNote Helper 项目内的高频任务。"
```
