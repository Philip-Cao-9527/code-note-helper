/**
 * LeetCode 笔记助手 推荐策略模块
 * 版本：1.0.37
 */

(function () {
    'use strict';

    const LING_SHEN_AUTHOR_KEYS = ['endlesscheng', '灵茶山艾府', '灵神'];

    /**
     * 统一作者名，减少大小写和空格干扰
     * @param {string} author
     * @returns {string}
     */
    function normalizeAuthor(author) {
        return (author || '').toString().trim().toLowerCase();
    }

    /**
     * 判断是否为灵神作者
     * @param {string} author
     * @returns {boolean}
     */
    function isLingShenAuthor(author) {
        const normalized = normalizeAuthor(author);
        if (!normalized) return false;
        return LING_SHEN_AUTHOR_KEYS.some(key => normalized.includes(key.toLowerCase()));
    }

    /**
     * 在题解数组中判断是否包含灵神题解
     * @param {Array} solutions
     * @returns {boolean}
     */
    function hasLingShenSolutionInList(solutions) {
        if (!Array.isArray(solutions) || solutions.length === 0) return false;
        return solutions.some(sol => isLingShenAuthor(sol?.author));
    }

    /**
     * 在格式化后的题解文本中判断是否包含灵神题解
     * @param {string} officialSolutionText
     * @returns {boolean}
     */
    function hasLingShenSolutionInText(officialSolutionText) {
        if (!officialSolutionText || typeof officialSolutionText !== 'string') return false;
        const lowerText = officialSolutionText.toLowerCase();
        return LING_SHEN_AUTHOR_KEYS.some(key => lowerText.includes(key.toLowerCase()));
    }

    /**
     * 推荐顺序：灵神优先，其余按点赞数降序，同赞按原顺序
     * @param {Array} solutions
     * @returns {Array}
     */
    function sortSolutionsForRecommendation(solutions) {
        if (!Array.isArray(solutions)) return [];
        if (solutions.length <= 1) return solutions.slice();

        const tagged = solutions.map((solution, index) => ({
            solution,
            index,
            isLingShen: isLingShenAuthor(solution?.author),
            upvoteCount: Number(solution?.upvoteCount || 0)
        }));

        const lingShenSolutions = tagged
            .filter(item => item.isLingShen)
            .sort((a, b) => a.index - b.index)
            .map(item => item.solution);

        const otherSolutions = tagged
            .filter(item => !item.isLingShen)
            .sort((a, b) => {
                if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount;
                return a.index - b.index;
            })
            .map(item => item.solution);

        return [...lingShenSolutions, ...otherSolutions];
    }

    /**
     * 按用户水平输出“推荐题解详细讲解”要求（与代码注释解耦）
     * @param {string} userLevel
     * @returns {{depth:string, focus:string, structure:string, mustInclude:string}}
     */
    function getRecommendationExplainRequirement(userLevel) {
        const map = {
            '小白': {
                depth: '从零开始、逐步拆解，默认读者不了解该算法。',
                focus: '先讲“为什么想到这个解法”，再讲“每一步在做什么”。',
                structure: '问题建模 -> 关键变量含义 -> 逐步执行过程 -> 小样例手推 -> 易错点回顾',
                mustInclude: '至少 1 个完整样例的逐步演算，并说明每个判断条件为何成立。'
            },
            '进阶选手': {
                depth: '兼顾完整性与节奏，重点讲清关键转折。',
                focus: '强调思路形成路径、核心不变量与常见变体。',
                structure: '思路来源 -> 关键步骤 -> 复杂度推导 -> 变体迁移',
                mustInclude: '至少 1 处“为什么不用另一个常见方案”的对比解释。'
            },
            '熟练选手': {
                depth: '精炼但完整，突出高价值信息。',
                focus: '重点解释优化点、边界策略、实现中的取舍。',
                structure: '核心结论 -> 关键优化点 -> 边界处理策略 -> 可复用模板',
                mustInclude: '至少 2 个关键边界场景，说明如何保证正确性。'
            },
            '专家': {
                depth: '高度凝练，优先讨论本质与可扩展性。',
                focus: '强调底层原理、复杂度瓶颈、可推广结论。',
                structure: '本质抽象 -> 复杂度下界/瓶颈 -> 进阶优化方向 -> 适用边界',
                mustInclude: '至少 1 条可推广到同类题型的抽象结论。'
            }
        };
        return map[userLevel] || map['小白'];
    }

    /**
     * 直接生成可拼接到 Prompt 的讲解要求文本
     * @param {string} userLevel
     * @returns {string}
     */
    function buildDetailedExplainPrompt(userLevel) {
        const rule = getRecommendationExplainRequirement(userLevel);
        return [
            `- 讲解深度：${rule.depth}`,
            `- 讲解重点：${rule.focus}`,
            `- 输出结构：${rule.structure}`,
            `- 必须包含：${rule.mustInclude}`
        ].join('\n');
    }

    window.NoteHelperRecommendation = {
        normalizeAuthor,
        isLingShenAuthor,
        hasLingShenSolutionInList,
        hasLingShenSolutionInText,
        sortSolutionsForRecommendation,
        getRecommendationExplainRequirement,
        buildDetailedExplainPrompt
    };
})();
