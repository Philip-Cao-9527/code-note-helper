/**
 * TorchCode Prompt 共享模块
 * 版本：1.0.80
 */

(function () {
    'use strict';

    const USER_LEVEL_GUIDE = {
        '小白': {
            style: '默认把读者当作几乎没有基础的人：先讲直觉，再讲公式和代码；每个关键步骤都要解释“为什么”。',
            floor: '核心讲解不少于 950 字。'
        },
        '进阶选手': {
            style: '兼顾直觉与推导，强调实现取舍、shape 变化、边界条件与调试路径。',
            floor: '核心讲解不少于 760 字。'
        },
        '熟练选手': {
            style: '强调关键细节与工程可迁移性，避免铺陈基础概念。',
            floor: '核心讲解不少于 620 字。'
        },
        '专家': {
            style: '突出原理本质、训练系统权衡、可扩展性与瓶颈定位。',
            floor: '核心讲解不少于 520 字。'
        }
    };

    const TASK_TYPE_PROFILES = {
        attention: {
            label: 'Attention 类',
            checkList: [
                'Q/K/V 的 shape、head 拆分与还原过程是否严格一致。',
                'mask 的形状、广播方向与取值语义是否正确。',
                '缩放与 softmax 前后的数值稳定处理是否完整。',
                'seq_q != seq_k 场景（如 cross-attention）是否被正确处理。',
                '训练与推理阶段是否区分 dropout、cache、causal 约束。'
            ],
            debugList: [
                '逐层打印 Q/K/V 与 attention score 的 shape。',
                '构造极小样例验证 mask 后被屏蔽位置是否近似零权重。',
                '检查 softmax 前最大值减法是否生效。',
                '用单头单样本样例手算 1 次结果并与代码对比。',
                '检查 causal mask 与 padding mask 叠加后的最终形状。'
            ],
            interviewFocus: 'QKV 设计动机、mask 机制、数值稳定、cache 与推理延迟、工程内核优化边界',
            highlightTrainInfer: true,
            highlightNumerical: true
        },
        tensor_shape: {
            label: 'Tensor 操作 / Shape 操作类',
            checkList: [
                '每一次 view/reshape/permute/transpose 是否保持语义正确。',
                '连续内存与非连续内存场景是否被正确处理。',
                '广播维度是否与预期一致，是否有隐式扩维风险。',
                '索引、切片与拼接操作是否会引入 silent bug。',
                '关键中间张量是否有断言或可验证的 shape 说明。'
            ],
            debugList: [
                '在每一步张量变换后打印 shape 与 dtype。',
                '对比 reshape 与 view 在非连续张量上的行为差异。',
                '对关键广播语句加断言验证输出维度。',
                '最小样例手工推导每一步结果。',
                '检查 inplace 操作是否污染后续计算。'
            ],
            interviewFocus: '广播机制、内存布局、算子等价变换、shape 断言策略',
            highlightTrainInfer: false,
            highlightNumerical: false
        },
        normalization_loss: {
            label: 'Normalization / Loss 类',
            checkList: [
                '归一化维度与参数形状是否匹配。',
                '训练态与推理态统计量行为是否正确。',
                'loss 输入 logits/probability 的语义是否混淆。',
                '是否处理了 epsilon、log(0) 等数值稳定细节。',
                'reduction 策略是否与题目要求一致。'
            ],
            debugList: [
                '打印均值/方差/标准差，检查是否出现异常值。',
                '检查 loss 前后张量范围是否合理。',
                '验证 reduction=none 与 mean/sum 结果关系。',
                '对极端输入测试是否出现 NaN/Inf。',
                '验证训练态和推理态输出差异是否符合预期。'
            ],
            interviewFocus: '归一化统计量、loss 函数数值稳定、梯度尺度、标签平滑与不平衡样本',
            highlightTrainInfer: true,
            highlightNumerical: true
        },
        training_optimization: {
            label: 'Training Loop / Optimization 类',
            checkList: [
                'zero_grad/backward/step 的调用顺序是否正确。',
                '学习率调度器与优化器步进时机是否一致。',
                '是否处理梯度裁剪、梯度累积与混合精度的边界。',
                '是否区分 train()/eval() 与 no_grad()。',
                '日志与监控指标是否足够定位训练异常。'
            ],
            debugList: [
                '打印每轮 loss、学习率、梯度范数。',
                '检查是否出现梯度爆炸或梯度恒为零。',
                '最小批量跑通前向+反向再扩展数据规模。',
                '验证梯度累积步数与实际 step 次数一致。',
                '验证混合精度下 scaler 更新是否正常。'
            ],
            interviewFocus: '优化器机制、调度策略、AMP、梯度累积、训练稳定性与可观测性',
            highlightTrainInfer: true,
            highlightNumerical: true
        },
        sequence: {
            label: 'CNN / RNN / Sequence 类',
            checkList: [
                '时序维度与 batch 维度是否始终一致。',
                'padding、pack/unpack、mask 逻辑是否闭合。',
                '隐藏状态初始化与传递是否正确。',
                '卷积/循环层输出 shape 与下游层是否匹配。',
                '长序列场景下梯度稳定性与效率是否可控。'
            ],
            debugList: [
                '打印每层输出 shape 与 hidden state shape。',
                '构造变长序列验证 mask 与 padding 位置。',
                '检查长序列时 loss 与梯度是否异常。',
                '验证训练态/推理态的状态复用逻辑。',
                '对边界长度（1、极长）做回归测试。'
            ],
            interviewFocus: '序列建模机制、状态传递、变长序列处理、训练稳定性与推理延迟',
            highlightTrainInfer: true,
            highlightNumerical: true
        },
        general: {
            label: '通用深度学习题',
            checkList: [
                '输入输出 shape 与函数签名是否一致。',
                '梯度路径是否连通，关键参数是否可学习。',
                '是否存在明显数值稳定风险。',
                '是否明确训练态与推理态差异。',
                '是否具备可执行的调试与验证路径。'
            ],
            debugList: [
                '打印关键中间变量 shape 与统计量。',
                '使用最小可复现样例先跑通流程。',
                '检查 NaN/Inf 与异常梯度。',
                '为关键假设添加断言。',
                '对边界输入与随机输入做回归测试。'
            ],
            interviewFocus: '建模假设、实现细节、稳定性、扩展性',
            highlightTrainInfer: true,
            highlightNumerical: true
        }
    };

    function headingLevelToNumber(level) {
        return {
            '#': 1,
            '##': 2,
            '###': 3,
            '####': 4
        }[level] || 2;
    }

    function buildHeading(level, title) {
        return `${level} ${title}`;
    }

    function escapeFence(text) {
        return String(text || '').replace(/```/g, '``` ');
    }

    function buildLinksMarkdown(links) {
        const entries = Object.entries(links || {})
            .filter(([, value]) => String(value || '').trim())
            .map(([key, value]) => `- ${key}: ${value}`);
        return entries.join('\n');
    }

    function buildReferenceImplementations(data) {
        const normalized = [];

        if (Array.isArray(data.referenceImplementations)) {
            data.referenceImplementations.forEach((item, index) => {
                const code = String(item && item.code || '').trim();
                if (!code) return;
                normalized.push({
                    name: String(item.name || `实现 ${index + 1}`),
                    source: String(item.source || ''),
                    code
                });
            });
        }

        if (!normalized.length && String(data.referenceCode || '').trim()) {
            normalized.push({
                name: '参考实现',
                source: '',
                code: String(data.referenceCode || '').trim()
            });
        }

        return normalized;
    }

    function buildReferenceBlock(referenceImplementations) {
        if (!referenceImplementations.length) {
            return '未提供参考实现。请在“参考实现与推荐实现”章节写明“无可用参考实现”，并仅在确有必要时给出推荐实现。';
        }

        return referenceImplementations.map((item, index) => {
            return [
                `### 参考实现 ${index + 1}：${item.name}`,
                item.source ? `来源：${item.source}` : '',
                '```python',
                escapeFence(item.code),
                '```'
            ].filter(Boolean).join('\n');
        }).join('\n\n');
    }

    function detectTaskType(data) {
        const text = [
            data.taskTitle,
            data.summary,
            data.rules,
            data.signature,
            data.learnContent,
            data.example,
            Array.isArray(data.codeTexts) ? data.codeTexts.join('\n') : '',
            Array.isArray(data.markdownTexts) ? data.markdownTexts.join('\n') : ''
        ].join('\n').toLowerCase();

        if (/\b(attention|self[\s-]*attention|cross[\s-]*attention|qkv|scaled[\s-]*dot|softmax|mask|causal|kv[\s-]*cache)\b/i.test(text)) {
            return 'attention';
        }
        if (/\b(batch[\s-]*norm|layer[\s-]*norm|group[\s-]*norm|normalization|cross[\s-]*entropy|nll[\s-]*loss|mse|bce|focal|label[\s-]*smoothing|loss)\b/i.test(text)) {
            return 'normalization_loss';
        }
        if (/\b(optimizer|learning[\s-]*rate|scheduler|backward|zero[\s-]*grad|grad(?:ient)?[\s-]*(?:clip|clipping|accum|accumulation)|autocast|amp|scaler|train(?:ing)?[\s-]*loop|epoch)\b/i.test(text)) {
            return 'training_optimization';
        }
        if (/\b(cnn|conv1d|conv2d|conv3d|rnn|lstm|gru|sequence|token|embedding|encoder|decoder|transformer)\b/i.test(text)) {
            return 'sequence';
        }
        if (/\b(reshape|view|permute|transpose|einsum|matmul|bmm|broadcast|squeeze|unsqueeze|concat|stack|tensor)\b/i.test(text)) {
            return 'tensor_shape';
        }
        return 'general';
    }

    function buildPageContextSnippets(data) {
        const snippets = [];

        function pushSnippet(source, content) {
            const normalized = String(content || '').trim();
            if (!normalized) return;
            snippets.push({
                source,
                content: normalized.replace(/\n{3,}/g, '\n\n')
            });
        }

        pushSnippet('示例', data.example);
        pushSnippet('规则与限制', data.rules);
        pushSnippet('题目摘要', data.summary);
        pushSnippet('学习提示', data.learnContent);

        (Array.isArray(data.markdownTexts) ? data.markdownTexts : [])
            .filter(Boolean)
            .slice(0, 4)
            .forEach((item, index) => pushSnippet(`页面 Markdown ${index + 1}`, item));

        (Array.isArray(data.codeTexts) ? data.codeTexts : [])
            .filter(Boolean)
            .slice(0, 4)
            .forEach((item, index) => pushSnippet(`页面代码 ${index + 1}`, item));

        const unique = [];
        const seen = new Set();
        for (const item of snippets) {
            const key = item.content.slice(0, 120);
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(item);
        }
        return unique.slice(0, 8);
    }

    function buildContextReferenceBlock(contextSnippets) {
        if (!contextSnippets.length) {
            return '- 页面未提供可复用上下文，可直接基于题意与代码进行分析。';
        }

        return contextSnippets.map((item) => {
            return `- ${item.source}\n\`\`\`text\n${escapeFence(item.content)}\n\`\`\``;
        }).join('\n\n');
    }

    function buildTypeProfileBlock(taskType) {
        const profile = TASK_TYPE_PROFILES[taskType] || TASK_TYPE_PROFILES.general;

        return [
            `- 判定题型：${profile.label}`,
            '- 核心检查清单：',
            ...profile.checkList.map((line) => `  - ${line}`),
            '- 调试清单偏重：',
            ...profile.debugList.map((line) => `  - ${line}`),
            `- 面试深挖重点：${profile.interviewFocus}`,
            `- 是否必须强调训练/推理差异：${profile.highlightTrainInfer ? '是' : '按题意可选'}`,
            `- 是否必须强调数值稳定性：${profile.highlightNumerical ? '是' : '按题意可选'}`
        ].join('\n');
    }

    function isLikelyBase64Text(text) {
        const compact = String(text || '').replace(/\s+/g, '');
        if (!compact || compact.length < 64) return false;
        if (compact.length % 4 !== 0) return false;
        if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return false;
        return !/[^\x00-\x7F]/.test(compact);
    }

    function sanitizeDeepMlText(text) {
        const normalized = String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/\u200b/g, '')
            .trim();
        if (!normalized) return '';
        if (/^\[object Object\]$/i.test(normalized)) return '';
        if (/earn flames again/i.test(normalized)) return '';
        if (/^\s*(view solution|run code)\s*$/i.test(normalized)) return '';
        if (isLikelyBase64Text(normalized)) return '';
        return normalized.replace(/\n{3,}/g, '\n\n');
    }

    function buildCommonHardRules(extraRules = []) {
        const baseRules = [
            '直接输出 Markdown 正文，不要写“好的/当然可以/下面开始”。',
            '必须完整展示“我的原题解”代码块，禁止只点评不贴代码。',
            '先判断我的实现是否正确：若已正确，优先解释为什么正确与如何更规范，不要机械重写几乎相同代码。',
            '若仅需小修，保持原始函数签名与整体写法，给出“修改点清单”；仅当实现缺失/错误/无法通过题目时，才给完整替代实现。',
            '参考实现优先用于校验正确性与边界，不得脱离参考实现另起炉灶；若参考实现有误，再明确给出修复依据。',
            '任何改动代码的行为都必须说明改动点、原因、收益与潜在副作用。',
            'shape、梯度路径、数值稳定性不能省略，不得只写空泛结论。',
            '所有代码块使用 ```python；若题目非 Python，也要确保语言标注与代码一致。',
            '严禁为了压缩篇幅而牺牲信息量，禁止套话、空话与流水账。',
            '禁止使用带有贬损含义的消极词汇，保持中性、专业、可执行的表达。'
        ];
        const extensionRules = Array.isArray(extraRules) ? extraRules.filter(Boolean) : [];
        return baseRules.concat(extensionRules);
    }

    function buildUserNotesResponseBlock(notes) {
        const normalized = String(notes || '').trim();
        if (!normalized) {
            return [
                '【我的疑问与体会】',
                '无（若用户未填写，请在对应章节写“无”，不得伪造问题）'
            ].join('\n');
        }

        return [
            '【我的疑问与体会】',
            `「${normalized}」 请针对以上用户的疑问与体会，进行**深度详细**的回应：`,
            '0. **必须逐字原样复述上面的用户疑问原文**，禁止改写、删减、总结、同义替换。',
            '1. **直接回答用户的每一个具体问题**，不要泛泛而谈',
            '2. **如果用户要求代码，必须提供完整可运行的代码块**，禁止只用文字描述代替',
            '3. **展开论述每个思路的可行性、优劣势和适用场景**',
            '4. **结合本题的具体数据特征和约束条件**进行分析',
            '5. **过程要有条理、分点论述**，而不是一段很长的文字'
        ].join('\n');
    }

    function buildQaOnlyUserNotesBlock(notes) {
        const normalized = String(notes || '').trim();
        const literal = normalized || '无';
        return [
            '【用户疑问与体会原文】',
            `「${literal}」`,
            '【强制要求】若原文非空，必须逐字保留以上原文（标点、顺序、换行都不能改），否则视为失败。'
        ].join('\n');
    }

    window.TorchCodePromptShared = {
        USER_LEVEL_GUIDE,
        TASK_TYPE_PROFILES,
        headingLevelToNumber,
        buildHeading,
        escapeFence,
        buildLinksMarkdown,
        buildReferenceImplementations,
        buildReferenceBlock,
        detectTaskType,
        buildPageContextSnippets,
        buildContextReferenceBlock,
        buildTypeProfileBlock,
        isLikelyBase64Text,
        sanitizeDeepMlText,
        buildCommonHardRules,
        buildUserNotesResponseBlock,
        buildQaOnlyUserNotesBlock
    };
})();

