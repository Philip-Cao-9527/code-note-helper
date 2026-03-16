/**
 * LeetCode prompt 生成器
 * 版本：1.0.42
 */

(function () {
    'use strict';

    
function detectCodeLanguage(code) {
        if (!code || typeof code !== 'string') return null;

        // Python 特征
        if (/\bdef\s+\w+\s*\(/.test(code) || /\bclass\s+Solution\s*:/.test(code) ||
            /^from\s+\w+\s+import\s/m.test(code) || /^import\s+\w+/m.test(code) ||
            /\bself\b/.test(code) || /\bprint\s*\(/.test(code)) {
            return 'python';
        }

        // Java 特征
        if (/\bclass\s+Solution\s*\{/.test(code) && (/\bpublic\b/.test(code) || /\bprivate\b/.test(code))) {
            return 'java';
        }
        if (/\bpublic\s+(static\s+)?(void|int|String|boolean|long|double)\s+\w+\s*\(/.test(code)) {
            return 'java';
        }

        // C++ 特征
        if (/^#include\s*</.test(code) || /\bvector\s*</.test(code) || /\busing\s+namespace\s+std/.test(code) ||
            /\b(unordered_map|unordered_set|map|set)\s*</.test(code) || /->\s*\w+/.test(code)) {
            return 'cpp';
        }
        if (/\bclass\s+Solution\s*\{/.test(code) && !(/\bpublic\b/.test(code))) {
            return 'cpp';
        }

        // JavaScript 特征
        if (/\b(var|let|const)\s+\w+\s*=/.test(code) || /=>\s*\{/.test(code) ||
            /function\s+\w+\s*\(/.test(code) || /\bconsole\.(log|error)\s*\(/.test(code)) {
            return 'javascript';
        }

        // Go 特征
        if (/^package\s+\w+/m.test(code) || /\bfunc\s+\w+\s*\(/.test(code) ||
            /\b:=\b/.test(code) || /\bfmt\.(Print|Sprintf)/.test(code)) {
            return 'go';
        }

        // C 特征
        if (/^#include\s*<stdio\.h>/.test(code) || /^#include\s*<stdlib\.h>/.test(code)) {
            return 'c';
        }

        // Rust 特征
        if (/\bfn\s+\w+\s*\(/.test(code) || /\blet\s+mut\s+/.test(code) || /\bimpl\s+\w+/.test(code)) {
            return 'rust';
        }

        // Kotlin 特征
        if (/\bfun\s+\w+\s*\(/.test(code) || /\bval\s+\w+\s*[=:]/.test(code) || /\bvar\s+\w+\s*[=:]/.test(code)) {
            return 'kotlin';
        }

        return null;
    }

    const LANGUAGE_ALIASES = {
        'python': ['python', 'py', 'python3'],
        'java': ['java'],
        'cpp': ['cpp', 'c++', 'cxx'],
        'c': ['c'],
        'javascript': ['javascript', 'js'],
        'typescript': ['typescript', 'ts'],
        'go': ['go', 'golang'],
        'rust': ['rust'],
        'kotlin': ['kotlin', 'kt'],
        'csharp': ['c#', 'csharp', 'cs'],
        'swift': ['swift'],
        'ruby': ['ruby', 'rb'],
        'php': ['php'],
        'dart': ['dart'],
        'scala': ['scala'],
        'elixir': ['elixir'],
        'erlang': ['erlang'],
        'racket': ['racket'],
        'cangjie': ['cangjie']
    };

    const RECOMMENDATION_EXPLAIN_FALLBACK_MAP = {
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

    let hasWarnedMissingRecommendationHelper = false;

    function getRecommendationHelper() {
        const helper = window.NoteHelperRecommendation;
        if (!helper && !hasWarnedMissingRecommendationHelper) {
            console.warn('[Note Helper] Recommendation 模块未加载，将降级为内置推荐规则');
            hasWarnedMissingRecommendationHelper = true;
        }
        return helper;
    }

    function buildRecommendationExplainPrompt(userLevel) {
        const helper = getRecommendationHelper();
        if (helper && typeof helper.buildDetailedExplainPrompt === 'function') {
            return helper.buildDetailedExplainPrompt(userLevel);
        }

        const fallbackRule = RECOMMENDATION_EXPLAIN_FALLBACK_MAP[userLevel] || RECOMMENDATION_EXPLAIN_FALLBACK_MAP['小白'];
        return [
            `- 讲解深度：${fallbackRule.depth}`,
            `- 讲解重点：${fallbackRule.focus}`,
            `- 输出结构：${fallbackRule.structure}`,
            `- 必须包含：${fallbackRule.mustInclude}`
        ].join('\n');
    }

    function detectLingShenSolution(officialSolution) {
        if (!officialSolution || typeof officialSolution !== 'string') return false;

        const helper = getRecommendationHelper();
        if (helper && typeof helper.hasLingShenSolutionInText === 'function') {
            return helper.hasLingShenSolutionInText(officialSolution);
        }

        return /endlesscheng|灵茶山艾府|灵神/i.test(officialSolution);
    }

    function filterSolutionByLanguage(content, targetLang) {
        if (!content || !targetLang) return content;

        const targetAliases = LANGUAGE_ALIASES[targetLang] || [targetLang];
        const multiLangCodeBlockRegex = /```([\w+#]+)\s+\[([^\]]+)\]\s*\n([\s\S]*?)```/g;

        const allMatches = content.match(multiLangCodeBlockRegex);
        if (!allMatches || allMatches.length < 2) {
            return content;
        }

        let hasTargetLanguage = false;
        for (const match of allMatches) {
            const tagMatch = match.match(/```[\w+#]+\s+\[([^\]]+)\]/);
            if (tagMatch) {
                const tagParts = tagMatch[1].split('-');
                const rawLang = tagParts.length > 1 ? tagParts.slice(1).join('-') : tagMatch[1];
                const solLang = rawLang.toLowerCase().replace(/\d+$/, '');

                const isTargetLang = targetAliases.some(alias =>
                    solLang.includes(alias) || alias.includes(solLang)
                );

                if (isTargetLang) {
                    hasTargetLanguage = true;
                    break;
                }
            }
        }

        if (!hasTargetLanguage) {
            return content;
        }

        let result = content.replace(multiLangCodeBlockRegex, (match, lang, fullTag, code) => {
            const tagParts = fullTag.split('-');
            const rawLang = tagParts.length > 1 ? tagParts.slice(1).join('-') : fullTag;
            const solLang = rawLang.toLowerCase().replace(/\d+$/, '');

            const isTargetLang = targetAliases.some(alias =>
                solLang.includes(alias) || alias.includes(solLang)
            );

            if (isTargetLang) {
                return '```' + lang + '\n' + code + '```';
            } else {
                return '';
            }
        });

        result = result.replace(/\n{3,}/g, '\n\n');

        return result;
    }

    function formatSolutionsForPrompt(solutions, userLanguage = null, isCustomUrl = false) {
        if (!solutions || solutions.length === 0) return '';

        const helper = getRecommendationHelper();
        const orderedSolutions = helper && typeof helper.sortSolutionsForRecommendation === 'function'
            ? helper.sortSolutionsForRecommendation(solutions)
            : solutions;

        return orderedSolutions.map((sol, index) => {
            const solutionNum = index + 1;
            const upvoteInfo = sol.upvoteCount ? ` | 👍 ${sol.upvoteCount} 赞` : '';
            let authorTag = sol.author || '未知作者';
            if (authorTag.toLowerCase() === 'endlesscheng') {
                authorTag = '灵茶山艾府(灵神)';
            } else if (authorTag.toLowerCase() === 'leetcode-solution') {
                authorTag = 'LeetCode官方题解';
            }

            let content = sol.content;
            if (userLanguage) {
                content = filterSolutionByLanguage(content, userLanguage);
            }

            const solutionLabel = isCustomUrl ? `自定义题解 ${solutionNum}` : `题解 ${solutionNum}`;

            return `
═══════════════════════════════════════════════════════════════
📝 【${solutionLabel}】 ${sol.title}
👤 作者：@${authorTag}${upvoteInfo}
═══════════════════════════════════════════════════════════════

${content}`;
        }).join('\n\n');
    }

    // === 完整的 Prompt 生成（包含所有约束） ===

    function generatePrompt(data) {
        const { noteTitle, problem, myCode, officialSolution, headingLevel, userLevel, notes, url } = data;

        const levelMap = { "#": 1, "##": 2, "###": 3, "####": 4, "#####": 5 };
        const levelNum = levelMap[headingLevel] || 3;
        const h1 = '#'.repeat(levelNum);
        const h2 = '#'.repeat(levelNum + 1);
        const h3 = '#'.repeat(levelNum + 2);

        // === 多题解/多方法检测逻辑 ===
        // 场景1: 多个独立题解（不同作者或同一作者的多篇独立题解）
        const hasMultipleDistinctSolutions = officialSolution && (
            officialSolution.includes('【题解 2】') ||
            officialSolution.includes('【自定义题解 2】') ||
            (officialSolution.match(/【题解 \d+】/g) || []).length >= 2 ||
            (officialSolution.match(/【自定义题解 \d+】/g) || []).length >= 2
        );

        // 场景2: 同一题解内包含多种方法（如灵神的题解经常包含 方法一/方法二/方法三）
        // 深度覆盖各类多方法标记形式
        const multiMethodPatterns = [
            // === 中文标记 ===
            /[方解思做]法[一二三四五六七八九十]+/g,           // 方法一、解法二、思路三、做法四
            /[方解思做]法\s*[1-9][0-9]?/g,                   // 方法1、解法2、思路3
            /参考代码\s*[一二三四五六七八九十1-9][0-9]?/g,   // 参考代码1、参考代码2、参考代码一
            /写法\s*[一二三四五六七八九十1-9][0-9]?/g,       // 写法一、写法1
            /代码\s*[一二三四五六七八九十1-9][0-9]?/g,       // 代码一、代码1、代码2
            /算法\s*[一二三四五六七八九十1-9][0-9]?/g,       // 算法一、算法1
            /实现\s*[一二三四五六七八九十1-9][0-9]?/g,       // 实现一、实现1
            // === 英文标记 ===  
            /Solution\s*[1-9][0-9]?/gi,                     // Solution 1, Solution 2
            /Approach\s*[1-9][0-9]?/gi,                     // Approach 1, Approach 2
            /Method\s*[1-9][0-9]?/gi,                       // Method 1, Method 2
            /Way\s*[1-9][0-9]?/gi,                          // Way 1, Way 2
            /Code\s*[1-9][0-9]?/gi,                         // Code 1, Code 2
            // === Markdown 标题格式 ===
            /#+\s*[方解思做]法\s*[一二三四五六七八九十1-9]+/g,  // ## 方法一
            /\*\*[方解思做]法\s*[一二三四五六七八九十1-9]+\*\*/g, // **方法一**
            /#+\s*参考代码\s*[1-9][0-9]?/g,                  // ## 参考代码1
            /#+\s*(Solution|Approach|Method)\s*[1-9]/gi,    // ## Solution 1
            /^#{1,6}\s*\d+\s*[.、]\s*[^\n]+/gm              // # 1. 标题形式 或 # 1、标题形式
        ];

        let hasMultipleMethodsInSingleSolution = false;
        if (officialSolution) {
            for (const pattern of multiMethodPatterns) {
                const matches = officialSolution.match(pattern);
                if (matches && matches.length >= 2) {
                    hasMultipleMethodsInSingleSolution = true;
                    console.log('[CodeNote Helper] 检测到单题解内多方法:', matches);
                    break;
                }
            }
        }

        // 综合判定：多个独立题解 或 单题解内多方法 都视为"多题解情况"
        const hasMultipleSolutions = hasMultipleDistinctSolutions || hasMultipleMethodsInSingleSolution;
        const hasLingShenSolution = detectLingShenSolution(officialSolution);
        const recommendationExplainPrompt = buildRecommendationExplainPrompt(userLevel);
        if (hasLingShenSolution) {
            console.log('[CodeNote Helper] 检测到灵神题解，推荐方案将强制指向灵神');
        }

        // 用户水平详细说明映射
        const levelDescMap = {
            '小白': '通俗易懂，多打比方，从零开始讲解',
            '进阶选手': '逻辑清晰，稍微深入一点，重点在常见套路',
            '熟练选手': '精炼准确，重点在优化思路和边界情况',
            '专家': '专业深入，探讨底层原理和进阶优化细节'
        };
        const levelDesc = levelDescMap[userLevel] || levelDescMap['小白'];

        // 根据用户水平动态生成代码注释要求
        const commentLevelMap = {
            '小白': {
                intensity: '极其详尽、掰开揉碎',
                target: '"小白也能完全理解"的程度',
                requirements: '每一行代码都要解释做什么、为什么这样做，多用比喻和通俗语言',
                extras: '变量含义、循环目的、条件判断的原因、边界情况处理、算法步骤说明都要详细解释'
            },
            '进阶选手': {
                intensity: '详细',
                target: '"能理解核心思路和关键步骤"的程度',
                requirements: '关键代码行要解释，常见套路可以简单带过',
                extras: '边界情况、易错点、算法核心步骤需要注释'
            },
            '熟练选手': {
                intensity: '简洁清晰',
                target: '"快速理解优化点和关键技巧"的程度',
                requirements: '只在关键优化点、边界情况、巧妙技巧处添加注释',
                extras: '边界情况和巧妙的优化技巧需要注释'
            },
            '专家': {
                intensity: '精练',
                target: '"快速理解算法本质和进阶优化"的程度',
                requirements: '只在底层原理、进阶优化、非常规技巧处添加注释',
                extras: '底层原理、复杂度分析的微妙之处、进阶优化点需要注释'
            }
        };
        const commentLevel = commentLevelMap[userLevel] || commentLevelMap['小白'];

        let rolePrompt = `我是 LeetCode【${userLevel}】，我需要你作为互联网大厂资深代码专家，耐心细致的给我讲解代码。请根据我提供的刷题信息，生成一份结构化的 Markdown 刷题笔记。讲解风格请根据我的水平进行调整（${levelDesc}）。`;

        let prompt = `## 任务说明
${rolePrompt}

## 输出格式要求

请严格按照以下结构输出（标题级别从 ${h1} 开始）：

${h1} ${noteTitle || '[笔记标题]'}
${h2} 题目内容
${h3} 题目描述
[整理后的题目描述，保留关键信息]
${h3} 输入描述
[输入格式说明]
${h3} 输出描述
[输出格式说明]

${h2} 原题解
\`\`\`python
[我的原始代码]
\`\`\`

${h2} 原题解评价
[请对原题解进行评价：]
- **评分**：[X]/10
- **时间复杂度**：[分析]
- **空间复杂度**：[分析]
- **优点**：[如有]
- **不足**：[如有]

${h2} 优化题解
`;

        if (hasMultipleSolutions) {
            prompt += `[基于提供的多个参考题解，输出以下内容：]

**🚨 核心原则：必须严格遵守参考题解的原始代码逻辑，禁止任何形式的代码改写或优化！**

**📝 代码注释要求（根据用户水平【${userLevel}】调整）：**
- 注释详细程度：**${commentLevel.intensity}**，达到${commentLevel.target}
- 注释重点：${commentLevel.requirements}
- 必须注释的内容：${commentLevel.extras}

**📚 推荐题解详细讲解要求（独立于代码注释）：**
${recommendationExplainPrompt}
- 强制位置：必须紧跟在“推荐方案”代码块之后输出，**中间不得插入其他章节**
- 强制完整性：必须输出独立小节标题与实质内容，**禁止省略/禁止只写一句话/禁止写“同上”**
- 强制篇幅：该小节总字数不少于 360 字，且至少 4 个要点
- 强制主次：该小节字数必须**严格高于任一“📎 非推荐题解简要代码讲解”**，建议至少达到对方的 1.3 倍
- 违规处理：若缺失该小节或位置错误，视为本次输出不合格，必须完整重写

${h3} 方案对比（必须包含作者列）
| 方案 | 作者 | 核心思路 | 时间复杂度 | 空间复杂度 | 推荐场景 |
|------|------|----------|-----------|-----------|---------|
[对比各个方案的优劣，确保涵盖所有提供的题解]

${h3} 推荐方案
${hasLingShenSolution ? '**🚨 灵神优先强制规则：已检测到 @endlesscheng（灵茶山艾府/灵神）题解，推荐方案必须选择该作者。**' : ''}
\`\`\`python
# ===== 推荐方案（来自 @作者名）=====
# 【整体思路】：在此简要描述算法的核心思想
# 【时间复杂度】：O(?)
# 【空间复杂度】：O(?)

# 严格保留参考题解的原始代码，添加详尽的逐行注释
# 每一行代码都要解释：做什么、为什么这样做
# 关键步骤要用 【步骤X】 标记
# 边界情况和易错点要用 # ⚠️ 注意：... 标记
\`\`\`
${h3} 📚 推荐题解详细讲解（必须输出，且必须紧跟在上方代码块之后）
[本小节是硬性必填项，禁止省略，禁止跳过，禁止用一句话代替]
- 讲解必须严格结合上方“推荐方案”的具体代码语句，不得泛化
- 先解释“为什么推荐这个方案”，再解释“关键语句如何工作”
- 至少包含 1 个关键步骤的执行过程拆解（可用小样例）
- 必须覆盖：核心思路、关键步骤、复杂度、边界与易错点
- 字数下限：360 字；要点下限：4 条

**选择理由**：[说明为什么推荐这个方案]

${h3} 其他可行方案（完整代码）
**⚠️ 重要：以下每个方案都必须包含完整可运行的代码块，禁止省略或用文字描述代替代码！**
**🚨 禁止修改原参考题解的代码逻辑，只能添加注释！**
**📝 每个方案都必须添加详细注释，帮助理解代码逻辑！**


**📎 非推荐题解简要代码讲解（硬约束，必须逐方案输出）：**
- 零章节间隔：每个“其他可行方案”代码块输出完后，下一小节必须立刻输出对应的“📎 非推荐题解简要代码讲解（方案X）”，中间禁止插入任何其他标题、表格或章节
- 一一对应：方案二代码块后只能跟“方案二讲解”；方案三代码块后只能跟“方案三讲解”；禁止错位、合并或集中到文末统一讲解
- 讲解范围：每个讲解控制在 180~320 字，且至少 3 个要点（核心思路、关键语句/数据结构作用、适用场景）
- 细节强度：核心思路与关键语句/数据结构作用必须充分展开，禁止一句话带过；“适用场景”可简洁描述（1~2 句）
- 违规处理：若缺失、错位、编号不一致或出现“统一讲解”，视为整份答案不合格，必须完整重写

${h3}# 方案二：[方案名称]
**核心思路**：[一句话说明]
\`\`\`python
# ===== 方案二（来自 @作者名）=====
# 【整体思路】：...
# 完整代码 - 严格保留原参考题解代码逻辑
# [必须输出原参考题解的完整代码，添加详细注释]
\`\`\`
**复杂度**：时间 O(?)，空间 O(?)


${h3} 📎 非推荐题解简要代码讲解（方案二，必须紧跟在上方代码块后）
- 核心思路：[不少于 90 字，说明该方案解决问题的主线、状态转移/循环不变量或关键推导过程]
- 关键语句/数据结构作用：[不少于 90 字，点名上方代码中的关键语句或结构，解释其作用与必要性]
- 适用场景：[1~2 句说明在什么输入规模/题型特征下适用]

${h3}# 方案三：[方案名称]（如有更多方案）
**核心思路**：[一句话说明]
\`\`\`python
# ===== 方案三（来自 @作者名）=====
# 【整体思路】：...
# 完整代码 - 严格保留原参考题解代码逻辑
# [必须输出原参考题解的完整代码，添加详细注释]
\`\`\`
**复杂度**：时间 O(?)，空间 O(?)


${h3} 📎 非推荐题解简要代码讲解（方案三，必须紧跟在上方代码块后）
- 核心思路：[不少于 90 字，说明该方案解决问题的主线、状态转移/循环不变量或关键推导过程]
- 关键语句/数据结构作用：[不少于 90 字，点名上方代码中的关键语句或结构，解释其作用与必要性]
- 适用场景：[1~2 句说明在什么输入规模/题型特征下适用]
`;
        } else {
            prompt += `**📝 代码注释要求（根据用户水平【${userLevel}】调整）：**
- 注释详细程度：**${commentLevel.intensity}**，达到${commentLevel.target}
- 注释重点：${commentLevel.requirements}
- 必须注释的内容：${commentLevel.extras}

**📚 推荐题解详细讲解要求（独立于代码注释）：**
${recommendationExplainPrompt}
- 强制位置：必须紧跟在“优化题解”代码块之后输出，**中间不得插入其他章节**
- 强制完整性：必须输出独立小节标题与实质内容，**禁止省略/禁止只写一句话/禁止写“同上”**
- 强制篇幅：该小节总字数不少于 220 字，且至少 4 个要点
- 违规处理：若缺失该小节或位置错误，视为本次输出不合格，必须完整重写

${hasLingShenSolution ? '**🚨 灵神优先强制规则：已检测到 @endlesscheng（灵茶山艾府/灵神）题解，推荐方案必须选择该作者。**' : ''}

\`\`\`python
# ===== 优化题解（来自 @作者名）=====
# 【整体思路】：在此简要描述算法的核心思想
# 【时间复杂度】：O(?)
# 【空间复杂度】：O(?)

# 严格保留参考题解的原始代码，添加详尽的逐行注释
# 每一行代码都要解释：做什么、为什么这样做
# 关键步骤要用 【步骤X】 标记
# 边界情况和易错点要用 # ⚠️ 注意：... 标记
# 变量命名的含义要在首次出现时解释
\`\`\`
${h3} 📚 推荐题解详细讲解（必须输出，且必须紧跟在上方代码块之后）
[本小节是硬性必填项，禁止省略，禁止跳过，禁止用一句话代替]
- 讲解必须严格结合上方“优化题解”的具体代码语句，不得泛化
- 先解释“为什么采用这个方案”，再解释“关键语句如何工作”
- 至少包含 1 个关键步骤的执行过程拆解（可用小样例）
- 必须覆盖：核心思路、关键步骤、复杂度、边界与易错点
- 字数下限：220 字；要点下限：4 条
`;
        }

        // 如果用户有疑问/体会，在优化题解之后、总结之前插入专门回应章节
        if (notes && notes.trim()) {
            prompt += `
${h2} 💡 对用户疑问与体会的专门回应

**🚨 此章节是重点！禁止敷衍或简单带过！🚨**

用户的原始疑问与体会：
「${notes}」

请针对以上用户的疑问与体会，进行**深度详细**的回应：
1. **直接回答用户的每一个具体问题**，不要泛泛而谈
2. **如果用户要求代码，必须提供完整可运行的代码块**，禁止只用文字描述代替
3. **展开论述每个思路的可行性、优劣势和适用场景**
4. **结合本题的具体数据特征和约束条件**进行分析
5. **过程要有条理、分点论述**，而不是一段很长的文字
`;
        }

        prompt += `
${h2} 总结与收获
[请从以下维度进行**深入、详尽**的总结，每个部分都需要展开论述，避免一句话带过：]

${h3} 解题思路归纳
[从${userLevel}视角详细分析：这道题的本质是什么？为什么要用这种算法？思考过程是怎样的？有没有其他思路被否定了，为什么？]

${h3} 复杂度分析
[详细推导时间复杂度和空间复杂度，说明每个循环/递归贡献了什么复杂度]

${h3} 关键技巧与模板
[必须给出可直接复用的**代码模板**，至少包含一个完整代码块；先列出关键技巧要点，再给“模板代码”代码块，并说明模板适用场景。禁止只给文字不给代码。]

${h3} 易错点与调试技巧
[详细列出常见错误，包括：边界条件、循环变量初始化、特殊输入处理等。如何避免这些错误？]

${h3} 相关题目与拓展
[必须给出可直接跳转的题目链接，使用 Markdown 链接格式，例如：- [题目名](https://leetcode.cn/problems/slug/)；至少列出 3 条，并说明难度递进关系。${notes ? '' : ''}]

---

## 原始输入内容

以下是需要整理的原始内容，请提取关键信息并按上述格式输出。

### 【笔记标题】
「${noteTitle || '请根据题目内容自行拟定'}」

### 【题目内容】
「
${problem || '未提供，请根据其他信息推断'}
」

### 【我的代码】
「
${myCode || '未提供'}
」

`;

        if (officialSolution && officialSolution.trim()) {
            if (hasMultipleSolutions) {
                prompt += `### 【题解方案（按点赞量排序）】
「
${officialSolution}
」

**⚡🚨 核心指令（必须严格执行） 🚨⚡**：
上面提供了多个题解方案（已标注作者和点赞数），请务必遵守以下要求：
1. **【禁止偷懒】**：必须阅读并分析**所有**提供的题解，**严禁**只挑选其中一两个而忽略其他！
2. **【强制输出对比表格】**：在解析推荐方案之前，**必须**先输出以下 Markdown 对比表格：
   | 方案 | 作者 | 核心思路 | 时间复杂度 | 空间复杂度 | 推荐场景 |
   |---|---|---|---|---|---|
   （确保表格**涵盖所有提供的题解**，绝不遗漏，并在“作者”列明确标注原作者名）
3. **【详细解析推荐方案】**：综合考虑面试适用性，选出一个最优方案作为“推荐方案”。
4. **【列举其他可行方案】**：将其他方案作为“其他可行方案”列出，并确保**每个方案都包含完整代码**。
${hasLingShenSolution ? '5. **【灵神优先强制规则】**：已检测到 @endlesscheng（灵茶山艾府/灵神）题解，"推荐方案"必须选择该作者方案。' : ''}
`;
            } else {
                prompt += `### 【参考题解】
「
${officialSolution}
」

**注意**：请在讨论此题解时标注原作者，格式：「来自 @作者名 的方案」
`;
            }
        } else {
            prompt += `### 【官方题解/参考答案】
「
空值。请你自行生成基于原题解的优化题解。要求：
1. 给出更优的时间/空间复杂度算法（如果可能）。
2. 代码风格规范，添加关键注释。
3. 详细解释优化点。
」
`;
        }

        prompt += `
### 【来源链接】
[题目链接](${url})
`;

        if (notes && notes.trim()) {
            prompt += `
### 【我的疑问/体会】
「
${notes}
」

**注意**：以上用户的疑问/体会已在上方指定位置（优化题解之后、总结之前）单独回应，请确保在正确位置输出该章节。
`;
        } else {
            prompt += `
### 【需要AI补充的内容】
请在"总结与收获"部分进行**深入全面**的分析，不要泛泛而谈：
1. 这道题的核心解题思路是什么？思考过程是怎样的？
2. 详细推导时间复杂度和空间复杂度（不要只给结论，要有推导过程）
3. 有哪些容易出错的地方？具体场景是什么？如何避免？
4. 这道题属于什么题型？模板是什么？有哪些类似题目可以迁移应用？（必须给出可点击的题目链接）
5. 如果我是${userLevel}，应该如何一步步建立解题直觉？
`;
        }

        prompt += `
---

## 注意事项
1. 直接输出 Markdown 内容，不要有任何额外说明
2. 代码块使用 \`\`\`python (或对应语言) 标注
3. 如果原题解有问题，在"优化题解"中给出修正版本
4. **讲解要详尽深入**，特别是"总结与收获"部分，需要展开论述，不要一句话带过。讲解要符合【${userLevel}】的接受程度（${levelDesc}）
5. **【强制要求】“关键技巧与模板”必须包含至少一个可直接复用的代码块模板**，不得只写文字说明
6. **【强制要求】“相关题目与拓展”必须提供可点击的题目链接（Markdown 链接格式）**
7. **【强制要求】引用参考题解时必须明确标注来源：**
   - 在讨论某个方案时，使用格式「来自 @作者名 的题解」或「作者 @作者名 采用了...」
   - 每个推荐方案和其他可行方案都必须标明来源于哪位作者
   - 如果某作者有多个题解思路，需分别标注区分
8. **【禁止使用消极词汇】**
   - 禁止在回答中出现"笨"这种词汇，哪怕是"笨办法"等看似中性的表述
   - 这类词汇可能会给使用者带来消极的心理暗示，影响学习体验
   - 请使用"朴素方法"、"直接方法"、"基础方法"等中性或积极的表述替代
9. **【强制要求】必须输出“📚 推荐题解详细讲解”小节：**
   - 该小节必须紧跟在“推荐方案/优化题解”的代码块后，禁止插入其他章节
   - 总字数不少于 220 字，且至少 4 个要点
   - 若存在“📎 非推荐题解简要代码讲解”，推荐题解详细讲解字数必须严格高于任一非推荐讲解
   - 若缺失、位置错误或内容明显敷衍，视为整份答案不合格并重写
10. **【强制要求】必须输出“📎 非推荐题解简要代码讲解”小节（仅多题解场景）：**
   - 每个“其他可行方案”代码块后，下一小节必须立刻输出对应编号讲解，禁止插入其他章节
   - 讲解必须与对应代码块严格绑定，禁止跨方案错位、合并讲解、或集中到文末统一讲解
   - 每个讲解必须为 180~320 字，且至少包含 3 个要点（核心思路、关键语句/数据结构作用、适用场景）
   - “核心思路”与“关键语句/数据结构作用”必须详细展开；“适用场景”可简洁描述，不要求解释未被推荐理由
   - 若缺失、错位、编号不一致或出现统一讲解，视为整份答案不合格并重写
${hasLingShenSolution ? `11. **【强制要求】已检测到灵茶山艾府(灵神)题解，推荐方案必须来自 @endlesscheng（灵茶山艾府/灵神）。**` : ''}

## 🚨🚨🚨 关于参考题解的【最高优先级】强制约束 🚨🚨🚨

**以下规则具有最高优先级，任何情况下都必须严格遵守：**

1. **【禁止改写代码逻辑】**
   - 必须100%保留参考题解的原始代码结构和逻辑
   - 禁止重新实现、优化、简化或"改进"参考题解的代码
   - 禁止将参考题解的循环改成递归、递归改成迭代等结构性修改
   - 禁止修改参考题解中的数据结构选择（如用列表替换哈希表等）

2. **【禁止添加防御性编程】**
   - 禁止添加原参考题解没有的边界检查代码
   - 禁止添加 try-except、null check、越界检查等防御性代码
   - **如果参考题解没有处理某种边界情况，你也不要添加**

3. **【变量名修改规则】**
   - 只有当变量名极度难以理解时（如单字母 a, b, c 且无上下文含义），才允许修改
   - 修改变量名时必须在注释中标注：\`# 原变量名: x，改为 current_sum 以便理解\`
   - 不得以"提高可读性"为由修改原本就合理的变量名（如 i, j, left, right, ans 等）

4. **【允许的修改】**
   - ✅ 添加**详尽的解释性注释**（不改变代码本身）—— 这是本次输出的**核心要求**
   - ✅ 修改极度难懂的变量名（需标注原变量名）
   - ✅ 调整代码格式和缩进（保持逻辑不变）
   - ✅ **语言翻译【强制要求】**：如果参考题解的代码语言与【我的代码】使用的语言不一致，必须翻译为【我的代码】使用的语言，且必须严格保持代码逻辑完全一致；若发生翻译，必须额外输出“【语言翻译说明】”并包含以下内容：
   - 必须明确标注：原始语言 -> 目标语言，以及触发翻译的原因（与【我的代码】语言保持一致）
   - 必须在翻译后的代码中，使用【目标语言的注释语法】标记关键语句对应的原代码，格式示例：# 原代码(Python): ... 或 // 原代码(Java): ...
   - 必须在代码后提供“翻译对照说明”：逐条说明关键语法、标准库调用、数据结构写法是如何等价翻译的，方便用户逐项校对

5. **【违规示例】**
   - ❌ 把 \`for i in range(n)\` 改成 \`for i, num in enumerate(nums)\`
   - ❌ 把 \`if len(s) == 0\` 改成 \`if not s\`
   - ❌ 添加 \`if nums is None: return []\` 这样的空值检查
   - ❌ 把参考题解的 while 循环改成等价的 for 循环

${hasMultipleSolutions ? `6. **【强制要求】多个参考题解时：**
   - **必须**在推荐方案前输出对比表格（包含作者列）
   - **必须**分析所有提供的方案，不得遗漏
   - **"其他可行方案"中的每个方案都必须包含完整可运行的代码块**
   - **每个非推荐方案代码块后，下一小节必须立刻输出对应的“📎 非推荐题解简要代码讲解（方案X）”**，中间不得插入任何其他标题/表格/章节
   - **非推荐讲解必须与方案编号一一对应**（方案二对应方案二，方案三对应方案三），禁止错位、合并或集中到末尾统一讲解
   - **非推荐讲解必须为 180~320 字，且至少 3 个要点**（核心思路、关键语句/数据结构作用、适用场景）
   - **核心思路与关键语句/数据结构作用必须尽可能详细**，禁止一句话概括；适用场景可简洁说明
   - **推荐题解详细讲解必须严格长于任一非推荐讲解**，且推荐讲解字数不得低于 360 字
   - 若出现缺失、错位、编号不一致或统一讲解，视为整份答案不合格并重写
   - 禁止使用"代码类似"、"思路同上"等省略表述` : ''}
${hasLingShenSolution ? `7. **【强制要求】灵神题解优先：**
   - 已检测到 @endlesscheng（灵茶山艾府/灵神）题解时，推荐方案必须来自该作者
   - 其他作者方案仅允许放入“其他可行方案”用于补充对比` : ''}
8. **【强制要求】推荐题解详细讲解小节不可省略：**
   - 必须紧跟在推荐方案/优化题解代码块后立即输出
   - 必须是独立标题小节，包含实质分析，不得只有模板句或占位语
   - 少于 220 字或要点少于 4 条视为违规；多题解场景下，若字数不高于任一非推荐讲解同样视为违规
`;
        return prompt;
    }

    // === Markdown 渲染 ===
    let lastAIResult = "";

    window.PromptGenerator = {
        generatePrompt,
        formatSolutionsForPrompt,
        detectCodeLanguage,
        filterSolutionByLanguage,
        LANGUAGE_ALIASES
    };
})();
