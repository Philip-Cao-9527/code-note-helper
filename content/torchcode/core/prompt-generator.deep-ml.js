/**
 * TorchCode Prompt 生成器（Deep-ML）
 * 版本：1.0.54
 */

(function () {
    'use strict';

    function getSharedModule() {
        return window.TorchCodePromptShared || null;
    }

    function buildDeepMlHardRules(shared) {
        return shared.buildCommonHardRules([
            '题目描述、规则、示例必须以 Deep-ML 页面有效信息为准，禁止混入 AI Tutor 噪音文案。',
            '优化题解本质是“参考实现对齐与讲解”：先对齐参考实现逻辑，再判断是否需要最小改动。',
            '若仅需小修，保持原函数签名并给最小改动版本；若必须重写，再给完整可运行版本。',
            '“优化题解详细讲解”是强制模块，必须紧跟优化题解代码之后输出；总字数不少于 360 字，且至少 4 个要点。',
            '“用户疑问与体会”是强制模块，必须在“优化题解详细讲解”之后、“总结与速记”之前输出。',
            '“用户疑问与体会”非空时，回应必须尽可能详细：不少于 420 字、至少 6 个要点、不得只给概述。',
            '每一条复杂度分析都要说明推导过程，不能只给 O() 结论。'
        ]);
    }

    function generateDeepMlPrompt(data) {
        const shared = getSharedModule();
        if (!shared) {
            return 'TorchCode Prompt 共享模块未加载，请刷新页面后重试。';
        }

        const headingLevel = data.headingLevel || '##';
        const levelNum = shared.headingLevelToNumber(headingLevel);
        const h1 = '#'.repeat(levelNum);
        const h2 = '#'.repeat(levelNum + 1);
        const h3 = '#'.repeat(levelNum + 2);

        const userLevel = data.userLevel || '小白';
        const levelGuide = shared.USER_LEVEL_GUIDE[userLevel] || shared.USER_LEVEL_GUIDE['小白'];
        const noteTitle = data.noteTitle || `${data.taskTitle || 'Deep-ML'} 深度学习笔记`;
        const referenceImplementations = shared.buildReferenceImplementations(data);
        const taskType = 'general';
        const hardRules = buildDeepMlHardRules(shared);
        const notesBlock = shared.buildUserNotesResponseBlock(data.notes);

        const taskTitle = shared.sanitizeDeepMlText(data.taskTitle) || '未提供';
        const difficulty = shared.sanitizeDeepMlText(data.difficulty) || '未标注';
        const signature = shared.sanitizeDeepMlText(data.signature) || '未提供';
        const description = shared.sanitizeDeepMlText(data.description || data.summary) || '未提供';
        const rules = shared.sanitizeDeepMlText(data.rules) || '未提供';
        const example = shared.sanitizeDeepMlText(data.example) || '未提供';
        const currentCode = shared.sanitizeDeepMlText(data.currentCode || data.starterCode) || '未提供';

        return `## 任务说明
我是 Deep-ML【${userLevel}】，请你作为互联网大厂资深算法与深度学习工程师，输出一份结构化、可复盘、可面试的 Markdown 刷题笔记。讲解风格请根据我的水平进行调整（${levelGuide.style}）。

## 输出格式要求
请严格按照以下结构输出（标题级别从 ${h1} 开始）：

${h1} ${noteTitle}
${h2} 1. 题目内容
${h3} 题目描述
[整理后的题目描述，保留关键约束与边界]
${h3} 输入输出与函数签名
[输入、输出、签名及关键 shape 约束]
${h3} 示例与规则
[只整理有效样例与规则，不要引用无关页面文本]

${h2} 2. 我的原题解
${h3} 原题解代码
\`\`\`python
[我的原始代码]
\`\`\`

${h2} 3. 原题解评价
- **完成度评分**：[X]/10
- **正确性**：[结论 + 关键依据]
- **时间复杂度**：[分析 + 推导过程]
- **空间复杂度**：[分析 + 推导过程]
- **形状/梯度/数值稳定性风险**：[逐条说明]

${h2} 4. 参考实现与优化题解
${h3} 参考实现（如有）
${h3} 优化题解
\`\`\`python
[若仅需小修，保持原函数签名并给最小改动版本；若必须重写，再给完整可运行版本]
\`\`\`
${h3} 修改点清单
- [改动点]
- [原因]
- [收益]
- [潜在副作用]

${h2} 5. 优化题解详细讲解（强制）
${h3} 核心思路与可行性
${h3} 逐段代码讲解
${h3} shape 追踪 / 梯度路径 / 数值稳定性
${h3} 适用场景与边界

${h2} 6. 用户疑问与体会（强制）
${h3} 逐条回应我的疑问与体会
${h3} 必要时代码补充（完整可运行）

${h2} 7. 调试与易错点
- 至少 6 条可执行调试清单
- 按“先验证 shape，再验证梯度，再验证边界”的顺序给出排查路径

${h2} 8. 面试深挖
- 至少 10 问，优先 12 问
- 每问必须包含：结论、原理、本题对应、追问方向
- 每问建议不少于 120 字，总字数建议不少于 1400 字

${h2} 9. 总结与速记
${h3} 一句话结论
${h3} 可复用模板
${h3} 速记卡片

## 强制位置与质量规则
1. 第 5 节必须紧跟第 4 节代码块之后输出，中间不得插入其他章节；字数不少于 360 字，至少 4 个要点。
2. 第 6 节必须紧跟第 5 节之后，且位于第 9 节之前；若“我的疑问与体会”非空，必须逐条回应并不少于 420 字、至少 6 个要点。
3. 若用户在疑问中要求代码，第 6 节必须提供完整可运行代码块，禁止仅文字解释。
4. 参考实现与优化题解必须显式说明关系：是“最小修订”还是“必要重写”，并给出判定依据。
5. 面试深挖必须不少于 10 问，每问都要完整四段（结论、原理、本题对应、追问方向），不得省略任何一段。
6. 若缺失第 5 节或第 6 节、或位置错误、或内容明显敷衍，视为整份输出不合格，必须重写。

## 硬性规则
${hardRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

## 题型分流结果（Deep-ML 默认关闭自动分流）
- 说明：Deep-ML 题库跨度较大，自动分流容易误判。为保证专业性，本模板默认不按关键字自动分流。
- 当前策略：统一使用“通用深度学习题”框架进行完整分析，再根据题面做细化展开。
${shared.buildTypeProfileBlock(taskType)}

## 原始输入
- 练习标题：${taskTitle}
- 难度：${difficulty}
- 签名：${signature}
- 题目描述：${description}
- 规则与限制：${rules}
- 示例：${example}
- 当前来源：${data.sourceLabel || 'Deep-ML 题库'}
- 当前页面：${data.sourceUrl || ''}

## 我的原题解（必须原样展示后再评价）
\`\`\`python
${shared.escapeFence(currentCode)}
\`\`\`

## 参考实现
${shared.buildReferenceBlock(referenceImplementations)}

## 相关链接
${shared.buildLinksMarkdown(data.links || {}) || '- 无'}

${notesBlock}
`;
    }

    window.TorchCodeDeepMlPrompt = {
        generateDeepMlPrompt
    };
})();
