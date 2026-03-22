/**
 * TorchCode Prompt 生成器（Workspace/HuggingFace）
 * 版本：1.0.80
 */

(function () {
    'use strict';

    function getSharedModule() {
        return window.TorchCodePromptShared || null;
    }

    function buildWorkspaceHardRules(shared) {
        return shared.buildCommonHardRules([
            '默认不输出替代方案，不强制做多 API 对比；仅在确有学习价值时，才在“工程实践补充（可选）”里用短篇幅补充。',
            '对于题目明确禁止调用的 API，不要展开大段比较，更不要把它当固定章节。',
            '“推荐实现详细讲解”是强制模块，必须紧跟推荐实现代码之后输出；总字数不少于 360 字，且至少 4 个要点。',
            '“用户疑问与体会”是强制模块，必须在“推荐实现详细讲解”之后、“总结与速记”之前输出。',
            '“用户疑问与体会”非空时必须尽可能详细：不少于 420 字、至少 6 个要点、不得只给概述。',
            '“面试深挖”是核心模块：至少 10 问，优先 12 问；每问必须包含“结论、原理、本题对应、追问方向”，且建议每问不少于 120 字。',
            '“相关题目推荐”为可选内容，若输出需简短且与本题强相关，禁止喧宾夺主。'
        ]);
    }

    function resolvePrimaryLink(data) {
        const links = data && data.links ? data.links : {};
        const first = Object.values(links).find((value) => String(value || '').trim());
        return String(first || data.sourceUrl || '').trim();
    }

    function generateWorkspaceQaPrompt(data, shared) {
        const headingLevel = data.headingLevel || '##';
        const levelNum = shared.headingLevelToNumber(headingLevel);
        const h1 = '#'.repeat(levelNum);
        const h2 = '#'.repeat(levelNum + 1);
        const userLevel = data.userLevel || '小白';
        const levelGuide = shared.USER_LEVEL_GUIDE[userLevel] || shared.USER_LEVEL_GUIDE['小白'];
        const noteTitle = data.noteTitle || data.taskTitle || 'TorchCode 练习';
        const link = resolvePrimaryLink(data);

        return `你是互联网大厂资深深度学习工程师。当前是“仅答疑”模式：请直接进入问题解答，避免冗长前置章节。

用户水平：${userLevel}
讲解风格：${levelGuide.style}

【输出结构（必须严格遵守）】
${shared.buildHeading(h1, noteTitle)}
${shared.buildHeading(h2, '题目信息')}
- 题目名称：${data.taskTitle || noteTitle}
- 题目链接：${link ? `[点击跳转](${link})` : '未提供'}

${shared.buildHeading(h2, '题目内容最简复述')}
[仅保留核心目标、关键约束和输入输出要点，不输出完整笔记大纲]

${shared.buildHeading(h2, '当前用户题解')}
\`\`\`python
${shared.escapeFence(data.currentCode || data.starterCode || '未提供')}
\`\`\`

${shared.buildHeading(h2, '用户疑问与体会原文')}
${shared.buildQaOnlyUserNotesBlock(data.notes)}

${shared.buildHeading(h2, '逐条答疑（必须详细）')}
1. [结论] + [原因] + [具体步骤] + [边界/反例] + [常见误区]
2. [继续逐条回答，每条都要落到用户原文对应的问题点]
[每条答疑不少于 180 字；若用户原文有 N 个疑问，至少输出 N 条答疑，不得合并]
[“逐条答疑”总字数不少于 520 字；若用户原文为空，也要输出不少于 320 字的问题拆解与建议]

${shared.buildHeading(h2, '必要代码（按需）')}
[只有在疑问需要代码时，才输出完整可运行代码块；不需要代码时明确写“本题当前疑问无需新增代码”。]

【原始输入（输入项保持原样）】
- 练习标题：${data.taskTitle || '未提供'}
- 难度：${data.difficulty || '未标注'}
- 签名：${data.signature || '未提供'}
- 题目摘要：${data.summary || '未提供'}
- 规则与限制：${data.rules || '未提供'}
- 示例：${data.example || '未提供'}
- 当前来源：${data.sourceLabel || 'TorchCode 工作区'}
- 当前页面：${data.sourceUrl || ''}
- 参考实现：${(Array.isArray(data.referenceImplementations) && data.referenceImplementations.length) || String(data.referenceCode || '').trim() ? '已提供' : '未提供'}

【强制规则】
1. 只展示一个题目名称与一个题目链接。
2. 若用户疑问原文非空，必须逐字原样输出原文；未原文输出视为失败。
3. 答疑必须逐条对应用户问题，不得只写概述；每条都必须包含“结论、原因、步骤、边界/反例、常见误区”。
4. 仅在必要时输出完整代码块，避免无关代码堆砌。
5. “逐条答疑”总字数必须达标：非空疑问不少于 520 字；空疑问不少于 320 字。
6. 直接输出 Markdown 正文，不要输出“好的/当然可以/下面开始”等套话。`;
    }

    function generateWorkspacePrompt(data) {
        const shared = getSharedModule();
        if (!shared) {
            return 'TorchCode Prompt 共享模块未加载，请刷新页面后重试。';
        }

        if (String(data.noteMode || '').trim() === 'qa_only') {
            return generateWorkspaceQaPrompt(data, shared);
        }

        const headingLevel = data.headingLevel || '##';
        const levelNum = shared.headingLevelToNumber(headingLevel);
        const h1 = '#'.repeat(levelNum);
        const h2 = '#'.repeat(levelNum + 1);
        const h3 = '#'.repeat(levelNum + 2);

        const userLevel = data.userLevel || '小白';
        const levelGuide = shared.USER_LEVEL_GUIDE[userLevel] || shared.USER_LEVEL_GUIDE['小白'];
        const noteTitle = data.noteTitle || `${data.taskTitle || 'TorchCode'} 深度学习笔记`;
        const referenceImplementations = shared.buildReferenceImplementations(data);
        const taskType = shared.detectTaskType(data);
        const contextSnippets = shared.buildPageContextSnippets(data);
        const hardRules = buildWorkspaceHardRules(shared);
        const notesBlock = shared.buildUserNotesResponseBlock(data.notes);

        return `你是互联网大厂的一线资深深度学习研发工程师，长期负责模型研发、训练系统与落地优化。请基于当前练习页面产出一份高约束、高信息密度、可复习可面试的 Markdown 学习笔记。

用户水平：${userLevel}
讲解风格：${levelGuide.style}
核心讲解篇幅下限：${levelGuide.floor}

【时效边界规则（必须遵守）】
1. 当你需要给出“最新工程实践 / 最新论文 / 最新框架接口”时，如果当前平台支持联网，先查询官方文档或论文再写结论。
2. 如果当前平台不支持联网，必须明确写出“以下工程补充基于已有知识，可能不是最新版本”，禁止伪装成最新结论。

【硬性规则】
${hardRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

【题型分流结果】
${shared.buildTypeProfileBlock(taskType)}

【固定输出结构（顺序不可改）】
${shared.buildHeading(h1, noteTitle)}
${shared.buildHeading(h2, '1. 练习概览')}
${shared.buildHeading(h3, '题目目标')}
${shared.buildHeading(h3, '输入输出与签名')}
${shared.buildHeading(h3, '规则与限制')}
${shared.buildHeading(h3, '页面上下文与调试样例')}

${shared.buildHeading(h2, '2. 我的原题解')}
${shared.buildHeading(h3, '原题解代码')}

${shared.buildHeading(h2, '3. 原题解评价')}
${shared.buildHeading(h3, '完成度评分与结论')}
${shared.buildHeading(h3, '正确性与边界')}
${shared.buildHeading(h3, '形状 / 梯度 / 数值稳定性风险')}
${shared.buildHeading(h3, '是否需要修改，为什么')}

${shared.buildHeading(h2, '4. 参考实现与推荐实现')}
${shared.buildHeading(h3, '参考实现（如有）')}
${shared.buildHeading(h3, '推荐实现代码（仅在确有必要时）')}
${shared.buildHeading(h3, '修改点清单')}

${shared.buildHeading(h2, '5. 推荐实现详细讲解（强制）')}
${shared.buildHeading(h3, '核心思路与关键取舍')}
${shared.buildHeading(h3, '逐段代码讲解')}
${shared.buildHeading(h3, '形状追踪 / 梯度路径 / 数值稳定性')}
${shared.buildHeading(h3, '训练与推理差异')}

${shared.buildHeading(h2, '6. 用户疑问与体会（强制）')}
${shared.buildHeading(h3, '逐条回应我的疑问与体会')}
${shared.buildHeading(h3, '补充代码与场景化建议（如需要）')}

${shared.buildHeading(h2, '7. 调试与易错点')}
${shared.buildHeading(h3, '可执行调试清单（至少 6 条）')}
${shared.buildHeading(h3, '常见错误模式与排查顺序')}

${shared.buildHeading(h2, '8. 面试深挖')}
${shared.buildHeading(h3, '基础原理追问')}
${shared.buildHeading(h3, '实现细节追问')}
${shared.buildHeading(h3, '训练稳定性追问')}
${shared.buildHeading(h3, '工程扩展追问')}

${shared.buildHeading(h2, '9. 总结与速记')}
${shared.buildHeading(h3, '一句话结论')}
${shared.buildHeading(h3, '可复用模板')}
${shared.buildHeading(h3, '速记卡片')}

【结构强制校验】
1. 第 5 节必须紧跟第 4 节之后，且总字数不少于 360 字，至少 4 个要点。
2. 第 6 节必须紧跟第 5 节之后，且位于第 9 节之前，不得挪位或省略。
3. 若“我的疑问与体会”为非空，第 6 节必须逐条回应并不少于 420 字、至少 6 个要点。
4. 面试深挖至少 10 问，每问必须包含“结论、原理、本题对应、追问方向”四段，建议每问不少于 120 字。
5. 面试深挖总字数建议不少于 1400 字，避免流于简答题。
6. 若引用参考实现，必须明确标注来源并说明与推荐实现之间的关系。

【原始输入】
- 练习标题：${data.taskTitle || '未提供'}
- 难度：${data.difficulty || '未标注'}
- 签名：${data.signature || '未提供'}
- 题目摘要：${data.summary || '未提供'}
- 规则与限制：${data.rules || '未提供'}
- 示例：${data.example || '未提供'}
- 当前来源：${data.sourceLabel || 'TorchCode 工作区'}
- 当前页面：${data.sourceUrl || ''}

【我的原题解（必须原样展示后再评价）】
\`\`\`python
${shared.escapeFence(data.currentCode || data.starterCode || '未提供')}
\`\`\`

【页面上下文素材（可选引用）】
${shared.buildContextReferenceBlock(contextSnippets)}

【参考实现】
${shared.buildReferenceBlock(referenceImplementations)}

【相关链接】
${shared.buildLinksMarkdown(data.links || {}) || '- 无'}

${notesBlock}
`;
    }

    window.TorchCodeWorkspacePrompt = {
        generateWorkspacePrompt
    };
})();

