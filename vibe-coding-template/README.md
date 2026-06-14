<div align="center">

# Vibe Coding Template

**Agent协作模板 · 本地 Skill · 结构校验**

`vibe-coding-template` 是一套可以复制到新项目里的本地 Skill 模板。
它帮助你把项目规则制定、prompt生成、代码评审、降低Agent幻觉和知识讲解等工作流整理成可复用的协作资产。
适合长期使用 Codex 或其他 Agent 辅助开发的个人项目与开源项目。

[目录结构](#structure) · [内置 skill](#built-in-skills) · [设计哲学](#philosophy) · [skill 配合](#skill-composition) · [校验脚本](#validation-scripts) · [推荐顺序](#recommended-order) · [引入新项目](#adoption) · [使用提醒](#reminders)

</div>

---

<a id="pain-points" name="pain-points"></a>
## 使用 Agent 写项目时，真正麻烦的地方

让 Agent 写出第一段代码通常不难，真正的难点在于如何跟 Agent 长期协作。

你可能会遇到这些情况：

* 换一个仓库，又要**重新**告诉 Agent 内容质量要求、测试方式和交付格式。
* 想让 Agent 做 code review，却很难让它真正围绕当前 diff、项目规则和潜在风险找问题。
* 想把一个高频流程沉淀下来，最后写出的 prompt 只能**应付当下任务**，下一次仍然要重新写 prompt。
* vibe coding根本看不懂Agent生成的代码或者是方案。遇到不熟悉的技术点时，往往需要先**补齐背景知识**，把核心原理、关键术语和项目落点讲清楚，否则后续项目开发的方向根本无法把握。
* 任务依赖最新官方文档、论文、API 或 benchmark，Agent 却凭旧知识给出**看似确定实则风险很高**的结论，后续开发无法摆脱模型幻觉。

<p align="center">
  <img src="assets/manage_AI_team.jpg" alt="学会Vibe Coding工作流" width="300">
</p>

`vibe-coding-template` 处理的就是这些协作问题。它不绑定具体业务，也不替项目规定唯一开发方式。你可以把它当成一套可调整的协作模板，按目标项目的真实内容落地。

这套模板不是凭空设计出来的，而是我在多个项目里反复使用 Agent、反复踩坑之后总结出来的。这里面既包括当前的浏览器拓展项目 [CodeNote Helper 的项目级 skills](https://github.com/Philip-Cao-9527/code-note-helper/tree/main/.agents/skills)，也包括我目前在开发的面向复制表格任务的Agent 工作流和 benchmark 评测的 [TableCodeAgent 项目级 skills](https://github.com/Philip-Cao-9527/TableCodeAgent/tree/main/.agents/skills)。它的重点不是把某个项目的规则原样复制出去，而是把这些项目里反复出现的问题提炼成可以迁移的协作模板。


---

<a id="structure" name="structure"></a>
## 目录结构

```text
vibe-coding-template/
├── README.md
└── skills/
    ├── agents-md-creator/          # 生成或更新项目级 AGENTS.md，沉淀长期协作规则
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── agents-template.md
    │   └── scripts/
    │       └── validate_agents_md.py
    ├── project-skill-creator/      # 创建项目本地 skill，把稳定流程沉淀成长期工具
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── skill-template.md
    │   └── scripts/
    │       └── validate_knowledge_explainer.py
    ├── project-prompt-creator/     # 生成一次性任务 prompt，用于开发、修复、验证和交接
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   ├── references/
    │   │   └── prompt-template.md
    │   └── scripts/
    │       └── validate_project_prompt.py
    ├── plan-mode-planner/          # 生成 Plan mode prompt，让复杂任务先决策再实现
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── plan-template.md
    ├── code-reviewer/              # 生成 code review prompt，帮助 Agent 找出真实问题
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── openai.yaml
    │   └── references/
    │       └── review-template.md
    ├── web-search/                 # 降低模型幻觉，把互联网最新信息转换为工程判断
    │   ├── SKILL.md
    │   └── agents/
    │       └── openai.yaml
    └── knowledge-explainer/        # 梳理技术原理、核心概念和可复述表达
        ├── SKILL.md
        └── agents/
            └── openai.yaml
```

`SKILL.md` 是每个 skill 的主体文件，记录触发场景、读取顺序、输出要求和自检项。

`agents/openai.yaml` 存放面向 OpenAI / ChatGPT skill 入口的展示信息。目标项目不使用这类入口时，可以不复制。

`references/` 适合放较长的模板、检查清单和示例输出。主体规则留在 `SKILL.md`，篇幅长的模板放进 `references/`，后续维护会更清楚。

`scripts/` 存放可复用的校验脚本。只有确实需要自动检查的结构才建议放脚本。

---

<a id="built-in-skills" name="built-in-skills"></a>
## 七个内置 skill

| Skill                                                            | 主要用途                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [agents-md-creator](skills/agents-md-creator/SKILL.md)           | 生成或更新项目级 `AGENTS.md`，沉淀长期生效的内容质量、编码、测试、版本、修改报告记录、错误处理和交付规则。                         |
| [project-skill-creator](skills/project-skill-creator/SKILL.md)   | 创建项目本地 skill，把高频、稳定、可复用的协作流程做成项目长期工具。                                               |
| [project-prompt-creator](skills/project-prompt-creator/SKILL.md) | 生成一次具体任务的可执行 prompt，适合开发、修复、文档、验证和交接任务。                                             |
| [plan-mode-planner](skills/plan-mode-planner/SKILL.md)           | 生成要求 Codex 先使用 Plan mode 的 prompt，适合方向未收敛、风险较高、需要用户拍板的任务。                           |
| [code-reviewer](skills/code-reviewer/SKILL.md)                   | 生成 code review prompt，帮助 AI 基于真实 diff、项目规则和证据发现问题，默认只输出审查报告和建议。                     |
| [web-search](skills/web-search/SKILL.md)                         | 用于降低 Agent 模型幻觉，为官方文档、论文、GitHub 仓库、标准、数据集、benchmark、release notes 和技术选型提供可追溯依据，并把来源差异转换为可验证的工程判断。 |
| [knowledge-explainer](skills/knowledge-explainer/SKILL.md)       | 生成技术原理、八股讲解、从零教学、面试口述和项目追问回答；涉及互联网最新信息时先调用 [web-search](skills/web-search/SKILL.md)。 |

---

<a id="philosophy" name="philosophy"></a>
## 设计哲学

`vibe-coding-template` 的核心不是多放几个 skill，而是把 Agent 协作拆成几类稳定问题。**项目规则怎么沉淀，复杂任务怎么先决策，踩过的坑怎么变成下次不会再犯的约束。**

### agents-md-creator

[agents-md-creator](skills/agents-md-creator/SKILL.md) 负责把项目长期规则写进 `AGENTS.md`。很多 Agent 协作问题，表面上是某次 prompt 没写好，实际原因是项目规则没有固定入口。每次都靠临时提醒，Agent 很容易忘记内容质量要求、测试方法、版本策略、修改报告记录格式、编码要求和错误处理边界。

#### 为什么要保留进度播报

长任务里最难受的不是 Agent 做得慢，而是用户不知道它在做什么。它可能在读文件，也可能在跑测试，也可能已经卡在某个报错里，但如果中间没有反馈，整个过程就像黑箱。

所以模板里保留了进度播报格式，适合执行命令、读写文件、测试页面、查看日志这类需要等待的场景。

> 🧩 步骤：{一句话描述正在做什么}<br>
> 🎯 目的：{为什么要做}<br>
> ▶️ 执行：{命令、页面、文件路径或操作}<br>
> ✅ 结果：{当前状态}<br>
> 🧾 证据：{可验证证据路径}<br>
> 📝 备注：{可选，最多一句}

它的作用不是增加仪式感，而是让 Agent 的工作过程**可观察、可追溯、可复盘**。用户不用每次都追问现在做到哪一步，也能看到当前进度在哪里，哪些事情还没有验证。


#### 为什么要禁止无依据的保护逻辑

这个约束来源于我在当前浏览器拓展项目里真实踩过的坑。Codex 很喜欢主动加一些**防御性编程**的逻辑。问题是这些逻辑如果没有依据，就会变成新的 bug。

这个问题发生在当前浏览器拓展项目 CodeNote Helper 的 API 客户端链路里。最新代码可以查看 [shared/api-client.js 的 callAI 流式请求部分](https://github.com/Philip-Cao-9527/code-note-helper/blob/main/shared/api-client.js#L234-L258)，以及 [shared/api-client.js 的错误处理部分](https://github.com/Philip-Cao-9527/code-note-helper/blob/main/shared/api-client.js#L520-L573)。现在的代码已经不再对流式生成设置固定 90 秒中断，而是围绕用户取消、页面关闭、网络异常和服务端错误这些有真实依据的路径处理。

当时在大语言模型 API 流式输出链路里，API 客户端被Codex偷偷加了一个固定 90 秒超时。

```js
const DIRECT_STREAM_TIMEOUT_MS = 90000;
```

流式请求开始后创建 `AbortController`，再用 `setTimeout` 在 90 秒后主动中断请求。

```js
let timeoutId = null;
let timedOut = false;

const controller = createLinkedAbortController(externalSignal);
if (controller) {
    timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, DIRECT_STREAM_TIMEOUT_MS);
}

const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
    },
    body: buildRequestBody(model, prompt, true),
    signal: controller ? controller.signal : externalSignal
});
```

随后在 `catch` 里把这次中断包装成接口超时。

```js
if (isAbortError(fetchError)) {
    if (timedOut) {
        throw new Error('API 调用失败: 接口响应超时，请稍后重试');
    }
    throw new Error('API 调用已取消');
}

if (timedOut) {
    throw new Error('API 调用失败: 接口响应超时，请稍后重试');
}
```

这样会导致一个很隐蔽的问题。只要流式生成超过 90 秒，不管模型是不是还在正常输出，前端都会主动中断请求，然后显示生成失败。

```text
生成失败：API 调用失败: 接口响应超时，请稍后重试
```

后来修复时移除了固定 90 秒超时，只保留用户取消、页面关闭、网络异常、服务端错误这些有真实依据的路径。这个例子让我意识到，很多看起来稳健的兜底，其实是在掩盖真实状态。

所以 `AGENTS.md` 里需要明确写清楚，不要无依据加入固定超时、长度截断、条数上限、重试上限、静默降级或隐藏兜底。如果确实要加限制，必须说明依据、触发条件、可见行为、误伤风险和验证方式。


#### 为什么要把版本和修改报告记录要求写清楚

很多项目里，版本号和修改报告记录容易被写乱。小文案调整也升级版本号，纯文档修改也写修改报告记录，真正影响运行行为的改动反而没有证据记录。时间一长，版本历史就失去参考价值。

[agents-md-creator](skills/agents-md-creator/SKILL.md) 的模板会把**版本号演进规则**和**修改报告记录要求**放进 `AGENTS.md`。默认情况下，纯文档修改、说明文字修正、技能文件调整、格式整理和注释修正不需要升级版本号。只有核心代码、可执行能力、项目行为、测试闭环或用户明确要求时，才需要考虑修改报告记录和版本记录。

这样做的好处是，每次改动结束后，用户能知道**这次到底改了什么、怎么验证的、证据在哪里、版本是否同步、还有什么边界风险**。

---

### plan-mode-planner

[plan-mode-planner](skills/plan-mode-planner/SKILL.md) 用来生成要求 Codex 先进入 Plan mode 的 prompt。它解决的不是写代码能力，而是复杂任务开始前的决策顺序。

#### 为什么复杂任务不能一上来就写代码

很多复杂任务失败，不是因为 Agent 不会写代码，而是它太早开始写代码。

举一个真实项目里很常见的场景。当前项目里原本有一套本地数据保存逻辑，现在要新增云端备份能力。看起来只是加几个按钮和一个同步接口，但**真正要先想清楚的是能力边界和回归范围**。备份逻辑应该直接塞进现有设置页面，还是**拆成独立的同步模块**；本地数据结构要不要调整；旧版本用户的数据怎么兼容；失败时是提示用户重试，还是**记录可恢复状态**；测试要只做脚本校验，还是必须覆盖**真实账号、真实浏览器或真实服务**。

如果**这些方向没有先定下来**，Agent 很可能先写出一版能跑的代码，然后后面才发现**模块边界不对、数据结构不好迁移、错误处理不符合项目习惯以及预期、测试也没有覆盖真实使用链路**。到这个时候再返工，就不是改几行代码的问题，而是要**重新设计调用链、文档、测试和修改报告记录**。

#### Plan mode 真正应该做什么

[plan-mode-planner](skills/plan-mode-planner/SKILL.md) 的重点，是让 Agent 在动手前先慢下来。

它生成的 prompt 会要求 Codex 先进入 Plan mode，只做只读探索、阅读、搜索、静态分析和必要的非破坏性核对。这个阶段不编辑文件，不生成修改报告记录，不修改版本号，也不提前写死详细方案。

Plan mode 真正要做的是提炼 **2 到 4 个值得用户拍板的关键决策点**。这些决策点应该来自项目真实上下文，而不是把一堆细节问题丢给用户。仍然以上面的云端备份能力为例，真正值得先确认的可能是这些问题：

第一，云端备份是作为现有设置页面的一部分继续扩展，还是拆成独立的同步能力。前者改动更小，但可能让设置页越来越臃肿；后者更清晰，但需要调整目录结构和调用关系。

第二，备份失败后的处理方式要不要改变现有用户体验。比如只是提示失败，还是保留同步状态、错误原因和下一次恢复入口。这个选择会影响数据结构、用户文案和测试范围。

第三，本轮验证测试应该做到什么程度。只做静态检查和脚本校验可以快速推进，但如果涉及真实账号、第三方服务或浏览器能力差异，就需要说明哪些结论必须留到真实环境验证。

这样的问题才适合在 Plan mode 阶段交给用户拍板。Agent 可以根据仓库事实给出倾向，但不能替用户直接决定方向。

#### 这种设计给用户带来的好处

用户不需要在一堆细枝末节里做选择，也不会被迫从几个已经写死的技术方案里盲选。

Plan mode 的价值，是先把真正影响代码方案的问题挑出来。用户只需要确认少数关键方向，后续实现就能围绕这些方向展开。这样可以**减少返工，避免写完代码才发现结构不对**。

---

### web-search

[web-search](skills/web-search/SKILL.md) 是降低 Agent 模型幻觉的有效工具。它不是只做互联网最新信息检索，而是把官方文档、论文、release notes、维护者说明和平台规则纳入定位链路，让 Agent 在代码判断、方案设计、benchmark 理解和风险结论上有可追溯依据。这个设计来自我在 CodeNote Helper 里的一次真实教训，也可以参考项目级版本 [CodeNote Helper web-search skill](https://github.com/Philip-Cao-9527/code-note-helper/tree/main/.agents/skills/web-search)。

#### 为什么本地代码有时不够

有些问题**只看本地代码很难定位**。对很多项目来说，问题可能来自**语言版本、运行时差异、依赖库行为变化、操作系统限制、云服务接口、第三方 SDK、认证协议、浏览器或移动端能力差异**，也可能来自**官方文档更新、社区已知问题或平台审核政策变化**。

**代码本身看起来合理，不代表它在真实环境里一定成立**。比如某个 API 在旧版本库里可用，但新版本已经改了返回结构；某个 SDK 在 Linux 上正常，在 Windows 上因为路径或编码问题失败；某个 OAuth 流程在一个平台能维持长期授权，在另一个平台必须走显式授权；某个 benchmark 的评测口径改了，旧实现虽然能跑，但**结果已经不能直接比较**。

我在当前项目 CodeNote Helper 的 Google Drive 授权问题上就遇到过这种情况。**多轮 code review 和代码修改都没有定位到关键原因**，后来结合互联网最新信息才确认，Microsoft Edge 浏览器不能沿用 Chrome 浏览器的设计路径使用 `chrome.identity.getAuthToken`，**Edge 浏览器需要采用 `launchWebAuthFlow`**。这意味着 refresh token、长期授权、后台自动同步和 OAuth Client 类型都会受到**浏览器差异**影响。

相关修改可以参考这个提交。

https://github.com/Philip-Cao-9527/code-note-helper/commit/23eff5a8a75df038817b6841bbd82645f618202b

这个案例说明，反复定位失败时，问题不一定藏在本地代码中，也可能来自最新的代码能力边界。**只依赖本地代码和模型记忆**，容易陷入模型幻觉带来的陷阱。

#### web-search 应该怎么参与工程判断

[web-search](skills/web-search/SKILL.md) 的价值，是把互联网最新信息转换为项目代码的工程判断，从源头降低模型凭记忆给出确定结论的风险。

它优先使用官方文档、浏览器厂商资料、供应商文档、官方 GitHub、release notes 和维护者讨论。社区讨论可以补充线索，但不能单独当作结论。

它的输出需要区分**已确认事实、来源冲突、工程推断和仍需真实环境验证的边界**。比如运行时版本差异、第三方服务限制、依赖库行为变化、认证流程、平台审核要求，这些都不能只凭模型记忆下结论。

#### 互联网最新信息不能替代本地代码审查

[web-search](skills/web-search/SKILL.md) 不会替代本地代码审查。正确的关系是本地调用链、互联网最新信息和真实验证边界一起定位问题。

互联网最新信息最终要回到**工程约束、测试要求、文档影响和风险边界**。比如某个官方文档说明平台能力不同，那就要进一步判断当前项目调用链受不受影响，测试要不要覆盖真实环境。

---

### knowledge-explainer

[knowledge-explainer](skills/knowledge-explainer/SKILL.md) 解决的是另一类常见问题。Agent 写代码很快，但用户自己并没有完全理解某个技术点。比如为什么数据处理流程要这样设计，为什么 benchmark 要用这种评测口径，为什么一个模型方法要拆成几个模块实现。如果这些问题没有被理解清楚，后续项目开发会越来越依赖 Agent 的输出，**用户自己却越来越难判断方案或者是代码是否合理**。


<p align="center">
  <img src="assets/vibe_coding_puzzle.jpg" alt="knowledge-explainer 设计哲学" width="300">
</p>

这个 skill 的设计哲学，是把 Agent 的产出从**用户能用**推进到**用户能理解、能判断**。它不满足于解释一个名词或者给出一段概念摘要，而是会**把技术点放回当前项目里讲清楚**。核心原理是什么，关键术语怎么理解，公式里的变量对应什么业务含义，评测指标为什么这样设计，工程实现为什么要做这些取舍，都应该被整理成**用户能真正吸收的说明**。

它的优点在于能把一次讲解变成**后续开发的判断依据**。用户再遇到代码实现、模型选择或面试追问的相关问题时，不只是记住了一个结论，而是知道**这个结论从哪里来、适用于什么场景、哪些地方还需要继续验证**。

当讲解涉及最新官方文档、论文或争议结论时，[knowledge-explainer](skills/knowledge-explainer/SKILL.md) 需要先联动 [web-search](skills/web-search/SKILL.md)。前者负责把技术点讲透，后者负责**补充互联网最新信息并降低模型幻觉**，两者结合后，讲解才既能帮助理解，也能保留清楚的**事实边界**。


---

<a id="skill-composition" name="skill-composition"></a>
## skill 之间怎么配合

[agents-md-creator](skills/agents-md-creator/SKILL.md) 处理**长期规则**。它适合生成 `AGENTS.md`，让后续所有 Agent 任务都能遵守同一套项目底线。**内容质量要求、编码要求、测试方式、版本策略、修改报告记录要求、错误处理和禁止事项**，都应该放在这里。

[project-prompt-creator](skills/project-prompt-creator/SKILL.md) 处理**一次性任务**。它把当前任务要做什么、先读什么、不能改什么、如何测试、交付什么写成**可执行 prompt**。任务完成后，这份 prompt 通常不会继续长期生效。

[plan-mode-planner](skills/plan-mode-planner/SKILL.md) 用在**还不能直接动手的任务**上。它要求执行者先读仓库和材料，再提炼**少数关键决策点**。用户确认方向后，才进入实现。

[code-reviewer](skills/code-reviewer/SKILL.md) 用来把一次审查任务写清楚，让 AI 围绕**真实改动、项目约定、测试证据和潜在影响**去找问题。它适合检查代码、配置、文档、PR diff、指定 commit 或发布前风险，输出审查报告。默认**不直接改代码**，避免还没确认问题就进入修复。

[project-skill-creator](skills/project-skill-creator/SKILL.md) 用来**沉淀新 skill**。某类流程反复出现，并且**输入、输出、读取顺序、模板和边界都比较稳定**时，再把它做成项目本地 skill。

[web-search](skills/web-search/SKILL.md) 处理**降低模型幻觉所需的互联网最新信息**。它优先查官方文档、作者仓库、论文、标准、release notes、维护者说明和数据集主页，并把这些来源转换为**可验证的工程判断**。

[knowledge-explainer](skills/knowledge-explainer/SKILL.md) 负责在**缺少背景知识**时先把技术原理讲清楚。它适合梳理不熟悉的技术栈、论文方法、架构概念、业务机制和面试追问，把**核心概念、关键术语、公式含义、项目落点和可复述表达**整理出来。涉及最新论文、官方文档或争议结论时，先让它调用 [web-search](skills/web-search/SKILL.md)。

---

<a id="validation-scripts" name="validation-scripts"></a>
## 为什么需要校验脚本

这套模板里有**三类内容**很容易在复制和二次生成时遗漏关键约束。

第一类是**项目级 `AGENTS.md`**。它容易被写成几条泛泛建议，缺少**内容质量要求、真实测试入口、版本规则、修改报告记录要求、错误处理边界和验收格式**。

第二类是**一次性任务 prompt**。它容易变成大纲，缺少**硬性前置要求、真实调用链、验证命令和交付物顺序**。

第三类是**讲解类 `SKILL.md`**。它最容易被压缩成提纲，原本要求的 **1000 / 3000 字门槛、公式解释、案例、比喻、记忆抓手、自检项和未实现能力边界** 会被悄悄删掉。

所以模板包为这些关键结构配了三个脚本。脚本只检查**重点结构是否还在**，不判断最终内容是否优雅，也不保证它已经适合目标项目。它的价值是先**挡住明显缺失**，再留给人工通读判断**项目事实、路径、版本、测试命令和风险边界是否真实**。

建议统一使用 **`python -X utf8`** 运行脚本，减少 **Windows 中文路径和控制台编码** 带来的干扰。

| 脚本                                                                                                      | 检查重点                                                                                                                                                                        | 命令                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [validate_agents_md.py](skills/agents-md-creator/scripts/validate_agents_md.py)                         | 检查 `AGENTS.md` 或 [agents-template.md](skills/agents-md-creator/references/agents-template.md) 是否保留执行环境、编码、修改前必读、内容质量要求、真实仓库结构、真实调用链、版本规则、修改报告记录要求、错误处理、测试验证、输出验收和进度播报等关键约束。 | `python -X utf8 vibe-coding-template/skills/agents-md-creator/scripts/validate_agents_md.py path/to/AGENTS.md`                                  |
| [validate_project_prompt.py](skills/project-prompt-creator/scripts/validate_project_prompt.py)          | 检查一次性任务 prompt 是否保留硬性前置要求、项目边界、版本与文档策略、TODO 分块、实现约束、验证命令、交付物顺序和 Markdown 文本块包裹要求。                                                                                           | `python -X utf8 vibe-coding-template/skills/project-prompt-creator/scripts/validate_project_prompt.py path/to/generated-prompt.md`              |
| [validate_knowledge_explainer.py](skills/project-skill-creator/scripts/validate_knowledge_explainer.py) | 检查讲解类 `SKILL.md` 是否保留 frontmatter、最高约束、1000 / 3000 字门槛、输出失败规则、讲解结构、质量门槛、自检项、未实现能力边界和 [web-search](skills/web-search/SKILL.md) 联动。                                           | `python -X utf8 vibe-coding-template/skills/project-skill-creator/scripts/validate_knowledge_explainer.py path/to/knowledge-explainer/SKILL.md` |

脚本失败时，不建议把报错当成可选建议。先根据缺失项补齐，再循环往复地测试校验。

脚本通过后，只能说明关键结构没有明显缺失，不能替代人工判断。人工通读时重点看这些内容：

* 路径是否属于目标项目。
* 测试命令是否真实可运行。
* 版本文件、修改报告记录目录和发布方式是否准确。
* 是否残留旧项目的私有模块名、站点、业务规则或审核约束。
* 任务边界是否清楚，是否会让 Agent 越权执行。

---

<a id="recommended-order" name="recommended-order"></a>
## 推荐使用顺序

+ 新项目可以先用 [agents-md-creator](skills/agents-md-creator/SKILL.md) 生成项目级 `AGENTS.md`。这一步先把长期协作底线写清楚，包括编码、内容质量要求、修改前必读、测试方式、版本策略、修改报告记录要求和错误处理。

+ 项目规则稳定后，用 [project-prompt-creator](skills/project-prompt-creator/SKILL.md) 组织具体任务。它适合开发、修复、验证。

+ 遇到方向不清、风险较高、需要用户先拍板决策的任务，用 [plan-mode-planner](skills/plan-mode-planner/SKILL.md)。先读仓库，再给出少数关键决策点，避免一开始就写死方案。

+ 需要审查 diff、PR、指定文件、配置变更或发布风险时，用 [code-reviewer](skills/code-reviewer/SKILL.md)。默认只输出审查报告和建议。

+ 任务依赖互联网最新信息、平台规则、论文、benchmark 或技术选型时，用 [web-search](skills/web-search/SKILL.md)。先建立来源依据，降低模型幻觉，再进入实现、讲解或审查。

+ 需要理解技术原理、准备面试口述、答辩表达或项目追问时，用 [knowledge-explainer](skills/knowledge-explainer/SKILL.md)。涉及最新资料时，先联动 [web-search](skills/web-search/SKILL.md)。

+ 某个流程反复出现，并且触发条件、输入、输出和边界都稳定后，再用 [project-skill-creator](skills/project-skill-creator/SKILL.md) 创建新的项目本地 skill。

---

<a id="adoption" name="adoption"></a>
## 引入新项目时的调整方式

将模板文件引入自己的新项目时，旧项目的规则往往会水土不服。建议先阅读新项目的 README、测试要求、发布工作流和关键目录，再按照以下步骤进行配置。

1. **替换占位变量**。将所有的 `{{...}}` 占位符修改为当前项目的真实路径、技术栈、版本文件、修改报告记录目录和测试命令。
2. **归类存放要求**。长期生效的约定放入 `AGENTS.md`，单次开发要求写进具体 prompt，高频操作封装为项目专属 skill。
3. **检查格式有效性**。确认 `SKILL.md` 的 frontmatter 结构完整，[agents/openai.yaml](skills/agents-md-creator/agents/openai.yaml) 填写有效，`references/` 和 `scripts/` 中引用的相关文件确实存在。
4. **运行校验脚本**。对 `AGENTS.md`、一次性任务 prompt、讲解类 `SKILL.md` 分别运行对应脚本，根据报错补齐缺失项。
5. **做一次真实测试**。选择一个低风险任务测试，观察 Agent 是否能按预期读取材料、发现问题、运行测试并交付结果。

---

<a id="reminders" name="reminders"></a>
## 使用时的几个提醒

+ `vibe-coding-template` 提供的是协作模板，真正决定质量的是目标项目里的真实信息。路径、命令、版本、内容质量要求、发布方式和风险边界，都要来自当前项目。

+ 不要把所有内容都塞进 `AGENTS.md`。长期规则放进 `AGENTS.md`，一次性需求写成 prompt，反复出现且边界稳定的流程再沉淀成 skill。

+ `AGENTS.md` 和 skill 不需要一次写到完美。更好的方式是随着项目推进，把自己实际踩过的坑、反复出现的偏差、已经验证过的工作流逐步沉淀进去。每次更新最好能对应**具体问题、真实经验或稳定流程**，这样规则才会越来越贴近项目，而不是停留在好看的原则上。

+ 不要把脚本通过当成质量保证。脚本只检查关键结构是否存在，最终内容仍然需要人工判断，也需要真实任务验证。
