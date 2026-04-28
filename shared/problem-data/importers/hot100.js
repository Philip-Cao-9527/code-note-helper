/**
 * 题单导入器（Hot100 / 面试经典150 / 灵神白名单题单）
 * 版本：1.2.0
 * 
 * 增强功能：
 * - 支持更多 URL 格式解析
 * - 增强数据提取逻辑
 * - 添加详细的错误日志和调试信息
 * - 支持任意学习计划 URL
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};

    const HOT100_CONFIG = constants.HOT100_CONFIG || {};
    const STUDY_PLAN_SUPPORTED_HOSTS = new Set([
        'leetcode.cn',
        'leetcode.com'
    ]);
    const STUDY_PLAN_CONFIGS = {
        'top-100-liked': {
            listId: HOT100_CONFIG.listId || 'lc-cn:studyplan:top-100-liked',
            sourceType: HOT100_CONFIG.sourceType || 'leetcode_studyplan',
            sourceUrl: HOT100_CONFIG.sourceUrl || 'https://leetcode.cn/studyplan/top-100-liked/',
            title: HOT100_CONFIG.title || 'LeetCode 热题 100',
            envType: HOT100_CONFIG.envType || 'study-plan-v2',
            envId: HOT100_CONFIG.envId || 'top-100-liked',
            planSlug: HOT100_CONFIG.planSlug || 'top-100-liked'
        },
        'top-interview-150': {
            listId: 'lc-cn:studyplan:top-interview-150',
            sourceType: 'leetcode_studyplan',
            sourceUrl: 'https://leetcode.cn/studyplan/top-interview-150/',
            title: '面试经典 150 题',
            envType: 'study-plan-v2',
            envId: 'top-interview-150',
            planSlug: 'top-interview-150'
        }
    };

    const LINGSHEN_DISCUSS_WHITELIST = {
        '0vinmk': { id: '0viNMK' },
        'sqopeo': { id: 'SqopEo' },
        '9ozfk9': { id: '9oZFK9' },
        'yixpxw': { id: 'YiXPXW' },
        'dhn9vk': { id: 'dHn9Vk' },
        '01luak': { id: '01LUak' },
        'txls3i': { id: 'tXLS3i' },
        'mor1u6': { id: 'mOr1u6' },
        'iyt3ss': { id: 'IYT3ss' },
        'g6ktkl': { id: 'g6KTKL' },
        'k0n2go': { id: 'K0n2gO' },
        'sjfwqi': { id: 'SJFwQI' }
    };
    const GENERIC_DISCUSS_TITLE_KEYWORDS = new Set([
        '讲解',
        '题解',
        '模板',
        '答案',
        '解析',
        '视频讲解',
        '视频题解',
        '讲义'
    ]);

    function normalizePath(pathname) {
        return String(pathname || '').replace(/\/+$/, '');
    }

    function buildNormalizedUrl(urlObject, normalizedPath) {
        return `${urlObject.origin}${normalizedPath}/`;
    }

    function resolveWhitelistedDiscussId(rawDiscussId) {
        const normalizedDiscussId = String(rawDiscussId || '').toLowerCase();
        const discussConfig = LINGSHEN_DISCUSS_WHITELIST[normalizedDiscussId];
        return discussConfig ? discussConfig.id : '';
    }

    function resolveLeetCodeOrigin(hostname) {
        return helpers.normalizeHost(hostname) === 'leetcode.com'
            ? 'https://leetcode.com'
            : 'https://leetcode.cn';
    }

    function buildStudyPlanQuestionUrl(slug, planConfig) {
        const origin = planConfig.problemOrigin || 'https://leetcode.cn';
        return `${origin}/problems/${slug}/description/?envType=${planConfig.envType}&envId=${planConfig.envId}`;
    }

    function buildProblemBaseUrl(slug, origin = 'https://leetcode.cn') {
        return `${origin}/problems/${slug}/`;
    }

    function escapeRegExp(source) {
        return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function logDebug(label, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[Importer][${timestamp}][${label}]`;
        if (data !== undefined) {
            console.log(prefix, data);
        } else {
            console.log(prefix);
        }
    }

    function logError(label, error) {
        const timestamp = new Date().toISOString();
        const prefix = `[Importer][${timestamp}][ERROR][${label}]`;
        console.error(prefix, error?.message || error);
        if (error?.stack) {
            console.error(prefix + ' STACK:', error.stack);
        }
    }

    function createImportError(message, details) {
        const error = new Error(message);
        error.code = 'import_error';
        error.details = details || {};
        return error;
    }

    function parseNextData(html, sourceLabel) {
        logDebug('parseNextData', `开始解析 ${sourceLabel} 页面的 __NEXT_DATA__`);
        
        try {
            const parser = new DOMParser();
            const documentNode = parser.parseFromString(html, 'text/html');
            const dataNode = documentNode.getElementById('__NEXT_DATA__');
            
            if (!dataNode) {
                logError('parseNextData', `未找到 __NEXT_DATA__ 脚本标签`);
                
                const allScripts = documentNode.querySelectorAll('script');
                logDebug('parseNextData', `页面共有 ${allScripts.length} 个 script 标签`);
                
                let nextDataFound = false;
                allScripts.forEach((script, index) => {
                    const text = script.textContent || '';
                    if (text.includes('__NEXT_DATA__') || text.includes('nextData')) {
                        logDebug('parseNextData', `脚本 ${index} 包含 NEXT_DATA 相关内容，长度: ${text.length}`);
                        nextDataFound = true;
                    }
                    if (script.id) {
                        logDebug('parseNextData', `脚本 ${index} id: ${script.id}`);
                    }
                });
                
                if (!nextDataFound) {
                    throw createImportError(
                        `未找到${sourceLabel}页面数据（__NEXT_DATA__不存在）`,
                        {
                            reason: 'NEXT_DATA_NOT_FOUND',
                            scriptCount: allScripts.length,
                            possibleSolutions: [
                                '页面可能需要登录才能查看',
                                'LeetCode 页面结构可能已更新',
                                '网络请求可能被拦截'
                            ]
                        }
                    );
                }
                
                throw createImportError(
                    `未找到${sourceLabel}页面数据（__NEXT_DATA__格式不正确）`,
                    {
                        reason: 'NEXT_DATA_INVALID_FORMAT',
                        possibleSolutions: [
                            'LeetCode 可能更新了页面渲染方式',
                            '请尝试刷新页面后重新导入'
                        ]
                    }
                );
            }

            if (!dataNode.textContent) {
                logError('parseNextData', `__NEXT_DATA__ 脚本标签内容为空`);
                throw createImportError(
                    `${sourceLabel}页面数据解析失败（内容为空）`,
                    {
                        reason: 'NEXT_DATA_EMPTY',
                        possibleSolutions: [
                            '页面可能未完全加载',
                            '网络请求可能被中断'
                        ]
                    }
                );
            }

            logDebug('parseNextData', `__NEXT_DATA__ 内容长度: ${dataNode.textContent.length}`);

            const nextData = helpers.safeJsonParse(dataNode.textContent);
            if (!nextData) {
                logError('parseNextData', `JSON 解析失败，内容预览: ${dataNode.textContent.substring(0, 200)}...`);
                throw createImportError(
                    `${sourceLabel}页面数据解析失败（JSON格式错误）`,
                    {
                        reason: 'NEXT_DATA_JSON_PARSE_FAILED',
                        possibleSolutions: [
                            'LeetCode 可能更新了数据格式',
                            '网络请求可能返回了错误页面'
                        ]
                    }
                );
            }

            logDebug('parseNextData', `解析成功，数据结构: ${Object.keys(nextData).join(', ')}`);
            
            if (nextData.props) {
                logDebug('parseNextData', `props 存在，keys: ${Object.keys(nextData.props).join(', ')}`);
            }

            return nextData;
        } catch (error) {
            if (error.code === 'import_error') {
                throw error;
            }
            logError('parseNextData', error);
            throw createImportError(
                `${sourceLabel}页面数据解析异常：${error?.message || '未知错误'}`,
                {
                    reason: 'PARSE_EXCEPTION',
                    originalError: error?.message
                }
            );
        }
    }

    function resolveStudyPlanDetail(nextData, sourceLabel) {
        logDebug('resolveStudyPlanDetail', `开始从 ${sourceLabel} 提取学习计划详情`);
        
        try {
            const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
            if (!Array.isArray(queries)) {
                logError('resolveStudyPlanDetail', `dehydratedState.queries 不是数组`);
                logDebug('resolveStudyPlanDetail', `nextData.props.pageProps: ${JSON.stringify(Object.keys(nextData?.props?.pageProps || {}))}`);
                
                const props = nextData?.props?.pageProps || nextData?.props || {};
                const allKeys = Object.keys(props);
                logDebug('resolveStudyPlanDetail', `可用的 prop keys: ${allKeys.join(', ')}`);
                
                const possibleKeys = allKeys.filter(k => 
                    k.toLowerCase().includes('study') || 
                    k.toLowerCase().includes('plan') ||
                    k.toLowerCase().includes('question') ||
                    k.toLowerCase().includes('problem')
                );
                if (possibleKeys.length > 0) {
                    logDebug('resolveStudyPlanDetail', `可能相关的键: ${possibleKeys.join(', ')}`);
                }
                
                throw createImportError(
                    `${sourceLabel}页面数据结构异常（未找到题目列表）`,
                    {
                        reason: 'STUDY_PLAN_DATA_NOT_FOUND',
                        availableKeys: allKeys,
                        possibleSolutions: [
                            'LeetCode 可能更新了学习计划页面结构',
                            '该学习计划可能需要登录才能访问',
                            '请尝试手动打开该链接确认页面是否正常'
                        ]
                    }
                );
            }

            logDebug('resolveStudyPlanDetail', `找到 ${queries.length} 个 queries`);

            let foundData = null;
            let foundType = null;
            
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                const stateData = query?.state?.data;
                
                if (!stateData) continue;
                
                if (stateData.studyPlanV2Detail) {
                    logDebug('resolveStudyPlanDetail', `在 query[${i}] 找到 studyPlanV2Detail`);
                    foundData = stateData.studyPlanV2Detail;
                    foundType = 'studyPlanV2Detail';
                    break;
                }
                
                if (stateData.studyPlanDetail) {
                    logDebug('resolveStudyPlanDetail', `在 query[${i}] 找到 studyPlanDetail`);
                    foundData = stateData.studyPlanDetail;
                    foundType = 'studyPlanDetail';
                    break;
                }
                
                if (stateData.questions || stateData.planSubGroups || stateData.subGroups) {
                    logDebug('resolveStudyPlanDetail', `在 query[${i}] 找到疑似学习计划数据结构`);
                    logDebug('resolveStudyPlanDetail', `stateData keys: ${Object.keys(stateData).join(', ')}`);
                    foundData = stateData;
                    foundType = 'custom';
                    break;
                }
            }

            if (!foundData) {
                logError('resolveStudyPlanDetail', `遍历所有 queries 后未找到学习计划数据`);
                logDebug('resolveStudyPlanDetail', `queries 预览:`);
                queries.forEach((q, i) => {
                    const queryKey = q?.queryKey || q?.state?.queryKey;
                    const dataKeys = Object.keys(q?.state?.data || {});
                    logDebug('resolveStudyPlanDetail', `  [${i}] key=${JSON.stringify(queryKey).substring(0, 60)} dataKeys=${dataKeys.join(', ')}`);
                });
                
                throw createImportError(
                    `未找到${sourceLabel}学习计划详情`,
                    {
                        reason: 'STUDY_PLAN_DETAIL_NOT_FOUND',
                        queryCount: queries.length,
                        possibleSolutions: [
                            'LeetCode 可能更新了学习计划数据结构',
                            '该学习计划可能是新版格式，暂不支持',
                            '请尝试在 LeetCode 页面打开后刷新再导入'
                        ]
                    }
                );
            }

            logDebug('resolveStudyPlanDetail', `找到数据类型: ${foundType}`);
            logDebug('resolveStudyPlanDetail', `数据结构 keys: ${Object.keys(foundData).join(', ')}`);

            return foundData;
        } catch (error) {
            if (error.code === 'import_error') {
                throw error;
            }
            logError('resolveStudyPlanDetail', error);
            throw createImportError(
                `提取${sourceLabel}学习计划详情失败：${error?.message || '未知错误'}`,
                {
                    reason: 'RESOLVE_EXCEPTION',
                    originalError: error?.message
                }
            );
        }
    }

    function resolveDiscussQuestion(nextData) {
        logDebug('resolveDiscussQuestion', '开始从 __NEXT_DATA__ 提取讨论帖内容');
        
        try {
            const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
            if (!Array.isArray(queries)) {
                logError('resolveDiscussQuestion', 'dehydratedState.queries 不是数组');
                throw createImportError(
                    '灵神题单页面数据结构异常',
                    {
                        reason: 'DISCUSS_DATA_NOT_FOUND',
                        possibleSolutions: [
                            'LeetCode 可能更新了讨论帖页面结构',
                            '该讨论帖可能已被删除或需要登录才能访问'
                        ]
                    }
                );
            }

            logDebug('resolveDiscussQuestion', `找到 ${queries.length} 个 queries`);

            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                const qaQuestion = query?.state?.data?.qaQuestion;
                
                if (qaQuestion) {
                    logDebug('resolveDiscussQuestion', `在 query[${i}] 找到 qaQuestion`);
                    logDebug('resolveDiscussQuestion', `qaQuestion keys: ${Object.keys(qaQuestion).join(', ')}`);
                    return qaQuestion;
                }
                
                const question = query?.state?.data?.question;
                if (question && question.content) {
                    logDebug('resolveDiscussQuestion', `在 query[${i}] 找到 question`);
                    return question;
                }
            }

            logError('resolveDiscussQuestion', '遍历所有 queries 后未找到讨论帖内容');
            throw createImportError(
                '未找到灵神题单内容',
                {
                    reason: 'DISCUSS_CONTENT_NOT_FOUND',
                    possibleSolutions: [
                        '该讨论帖可能已被删除',
                        'LeetCode 可能更新了讨论帖数据结构'
                    ]
                }
            );
        } catch (error) {
            if (error.code === 'import_error') {
                throw error;
            }
            logError('resolveDiscussQuestion', error);
            throw createImportError(
                `提取讨论帖内容失败：${error?.message || '未知错误'}`,
                {
                    reason: 'RESOLVE_EXCEPTION',
                    originalError: error?.message
                }
            );
        }
    }

    function extractProblemLinkMeta(rawUrl) {
        if (!rawUrl) return null;
        const source = String(rawUrl).trim().replace(/&amp;/g, '&');
        try {
            const urlObject = new URL(source);
            const host = helpers.normalizeHost(urlObject.hostname);
            if (host !== 'leetcode.cn' && host !== 'leetcode.com') return null;

            const segments = String(urlObject.pathname || '').split('/').filter(Boolean);
            if (segments.length < 2 || segments[0] !== 'problems') return null;

            const slug = String(segments[1] || '').toLowerCase();
            if (!/^[a-z0-9-]+$/.test(slug)) return null;
            return {
                slug,
                origin: resolveLeetCodeOrigin(host),
                isSolution: segments[2] === 'solutions'
            };
        } catch (error) {
            return null;
        }
    }

    function extractProblemSlug(rawUrl) {
        const meta = extractProblemLinkMeta(rawUrl);
        if (!meta || meta.isSolution) {
            return '';
        }
        return meta.slug;
    }

    function normalizeDiscussTitle(rawTitle, fallbackSlug) {
        const source = String(rawTitle || '')
            .replace(/[`*_]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!source) return fallbackSlug;

        const withoutPrefix = source.replace(/^\d+\.\s*/, '').trim();
        const withoutScore = withoutPrefix.replace(/\s+\d{3,5}$/, '').trim();
        return withoutScore || fallbackSlug;
    }

    function isGenericDiscussTitle(rawTitle) {
        const normalized = String(rawTitle || '')
            .replace(/[`*_]/g, '')
            .replace(/[：:·•|｜\-\s]+/g, '')
            .trim()
            .toLowerCase();
        return normalized ? GENERIC_DISCUSS_TITLE_KEYWORDS.has(normalized) : false;
    }

    function extractFrontendQuestionId(rawTitle) {
        const matchResult = String(rawTitle || '').match(/^\s*(\d+)\./);
        return matchResult ? matchResult[1] : '';
    }

    function collectDiscussProblemItems(content) {
        logDebug('collectDiscussProblemItems', `开始从讨论帖内容提取题目链接，内容长度: ${content.length}`);
        
        const source = String(content || '');
        const candidates = [];
        const occupiedRanges = [];
        
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/leetcode\.(?:cn|com)\/problems\/[^)\s]+)\)/gi;
        let markdownMatch;
        let markdownCount = 0;
        
        while ((markdownMatch = markdownLinkRegex.exec(source))) {
            const meta = extractProblemLinkMeta(markdownMatch[2]);
            if (!meta) continue;
            markdownCount++;
            occupiedRanges.push([markdownMatch.index, markdownMatch.index + markdownMatch[0].length]);
            candidates.push({
                slug: meta.slug,
                origin: meta.origin,
                isSolution: meta.isSolution,
                url: markdownMatch[2],
                title: normalizeDiscussTitle(markdownMatch[1], ''),
                frontendQuestionId: extractFrontendQuestionId(markdownMatch[1]),
                index: markdownMatch.index
            });
        }
        
        logDebug('collectDiscussProblemItems', `找到 ${markdownCount} 个 Markdown 格式的题目链接`);

        const urlRegex = /https?:\/\/leetcode\.(?:cn|com)\/problems\/[^\s)"'<>]+/gi;
        let urlMatch;
        let plainUrlCount = 0;
        
        while ((urlMatch = urlRegex.exec(source))) {
            const overlap = occupiedRanges.some(([start, end]) => urlMatch.index >= start && urlMatch.index < end);
            if (overlap) continue;
            const meta = extractProblemLinkMeta(urlMatch[0]);
            if (!meta) continue;
            plainUrlCount++;
            candidates.push({
                slug: meta.slug,
                origin: meta.origin,
                isSolution: meta.isSolution,
                url: urlMatch[0],
                title: '',
                frontendQuestionId: '',
                index: urlMatch.index
            });
        }
        
        logDebug('collectDiscussProblemItems', `找到 ${plainUrlCount} 个纯 URL 格式的题目链接`);
        logDebug('collectDiscussProblemItems', `总共找到 ${candidates.length} 个候选题目`);

        const entries = new Map();
        candidates
            .sort((left, right) => left.index - right.index)
            .forEach((candidate) => {
                const existing = entries.get(candidate.slug) || {
                    slug: candidate.slug,
                    origin: candidate.origin,
                    problemUrl: buildProblemBaseUrl(candidate.slug, candidate.origin),
                    firstIndex: candidate.index,
                    titles: [],
                    frontendQuestionIds: []
                };

                if (!candidate.isSolution) {
                    existing.problemUrl = buildProblemBaseUrl(candidate.slug, candidate.origin);
                }
                if (candidate.title && !isGenericDiscussTitle(candidate.title)) {
                    existing.titles.push({
                        title: candidate.title,
                        priority: candidate.isSolution ? 1 : 2
                    });
                }
                if (candidate.frontendQuestionId) {
                    existing.frontendQuestionIds.push(candidate.frontendQuestionId);
                }

                entries.set(candidate.slug, existing);
            });

        const result = Array.from(entries.values()).map((entry) => {
            const sortedTitles = entry.titles.sort((left, right) => right.priority - left.priority);
            let resolvedTitle = sortedTitles[0] ? sortedTitles[0].title : '';
            if (!resolvedTitle) {
                const context = source.slice(Math.max(0, entry.firstIndex - 120), Math.min(source.length, entry.firstIndex + 220));
                const titlePattern = new RegExp(`(?:\\[)?(\\d+\\.\\s*[^\\]\\n\\r]{1,80})(?:\\])?(?=[^\\n\\r]{0,120}https?:\\/\\/leetcode\\.(?:cn|com)\\/problems\\/${escapeRegExp(entry.slug)}(?:\\/|\\b))`, 'i');
                const titleMatch = context.match(titlePattern);
                resolvedTitle = titleMatch ? normalizeDiscussTitle(titleMatch[1], '') : '';
            }
            if (!resolvedTitle || isGenericDiscussTitle(resolvedTitle)) {
                resolvedTitle = entry.slug;
            }

            return {
                slug: entry.slug,
                title: normalizeDiscussTitle(resolvedTitle, entry.slug),
                frontendQuestionId: entry.frontendQuestionIds[0] || '',
                url: entry.problemUrl
            };
        });

        logDebug('collectDiscussProblemItems', `去重后得到 ${result.length} 个唯一题目`);
        return result;
    }

    function parseImportTarget(url) {
        logDebug('parseImportTarget', `开始解析导入 URL: ${url}`);
        
        try {
            const urlObject = new URL(String(url || '').trim());
            const normalizedHost = helpers.normalizeHost(urlObject.hostname);
            
            logDebug('parseImportTarget', `解析结果: host=${normalizedHost}, pathname=${urlObject.pathname}`);

            const pathname = normalizePath(urlObject.pathname);
            
            const studyPlanMatch = pathname.match(/^\/studyplan\/([^/]+)$/);
            if (studyPlanMatch) {
                logDebug('parseImportTarget', `匹配到学习计划 URL 格式`);
                
                if (!STUDY_PLAN_SUPPORTED_HOSTS.has(normalizedHost)) {
                    logError('parseImportTarget', `不支持的学习计划域名: ${normalizedHost}`);
                    return null;
                }
                
                const planSlug = String(studyPlanMatch[1] || '').toLowerCase();
                logDebug('parseImportTarget', `学习计划 slug: ${planSlug}`);
                
                const planConfig = STUDY_PLAN_CONFIGS[planSlug];
                const origin = resolveLeetCodeOrigin(normalizedHost);
                
                if (planConfig) {
                    logDebug('parseImportTarget', `找到预定义的学习计划配置: ${planConfig.title}`);
                    return {
                        type: 'studyplan',
                        sourceUrl: `${origin}/studyplan/${planConfig.planSlug}/`,
                        planConfig: {
                            ...planConfig,
                            sourceUrl: `${origin}/studyplan/${planConfig.planSlug}/`,
                            problemOrigin: origin,
                            site: normalizedHost
                        }
                    };
                }
                
                logDebug('parseImportTarget', `未找到预定义配置，尝试创建动态学习计划配置`);
                return {
                    type: 'studyplan',
                    sourceUrl: `${origin}/studyplan/${planSlug}/`,
                    planConfig: {
                        listId: `lc-${normalizedHost === 'leetcode.com' ? 'com' : 'cn'}:studyplan:${planSlug}`,
                        sourceType: 'leetcode_studyplan',
                        sourceUrl: `${origin}/studyplan/${planSlug}/`,
                        title: `学习计划: ${planSlug}`,
                        envType: 'study-plan-v2',
                        envId: planSlug,
                        planSlug: planSlug,
                        problemOrigin: origin,
                        site: normalizedHost
                    }
                };
            }

            if (normalizedHost !== 'leetcode.cn') {
                logDebug('parseImportTarget', `非 leetcode.cn 域名，跳过讨论帖解析`);
                return null;
            }

            const discussMatch = pathname.match(/^\/circle\/discuss\/([^/]+)$/i);
            if (discussMatch) {
                logDebug('parseImportTarget', `匹配到 circle/discuss 格式`);
                const discussId = resolveWhitelistedDiscussId(discussMatch[1]);
                if (discussId) {
                    logDebug('parseImportTarget', `匹配到灵神白名单题单: ${discussId}`);
                    return {
                        type: 'lingshen',
                        discussId,
                        sourceUrl: `https://leetcode.cn/circle/discuss/${discussId}/`
                    };
                }
                
                logDebug('parseImportTarget', `不在白名单中，但仍作为普通讨论帖处理: ${discussMatch[1]}`);
                return {
                    type: 'leetcode_post',
                    postId: String(discussMatch[1] || '').trim(),
                    sourceUrl: buildNormalizedUrl(urlObject, pathname)
                };
            }

            const discussPostMatch = pathname.match(/^\/discuss\/post\/(\d+)(?:\/[^/]+)?$/i);
            if (discussPostMatch) {
                logDebug('parseImportTarget', `匹配到 discuss/post 格式`);
                const postId = String(discussPostMatch[1] || '').trim();
                if (!postId) return null;
                return {
                    type: 'leetcode_post',
                    postId,
                    sourceUrl: buildNormalizedUrl(urlObject, pathname)
                };
            }

            const oldDiscussMatch = pathname.match(/^\/discuss\/([^/]+)$/i);
            if (oldDiscussMatch && !oldDiscussMatch[1].startsWith('post')) {
                logDebug('parseImportTarget', `尝试匹配旧版讨论帖格式`);
                const discussId = resolveWhitelistedDiscussId(oldDiscussMatch[1]);
                if (discussId) {
                    return {
                        type: 'lingshen',
                        discussId,
                        sourceUrl: `https://leetcode.cn/circle/discuss/${discussId}/`
                    };
                }
            }

            logDebug('parseImportTarget', `URL 格式不匹配任何支持的类型`);
            return null;
        } catch (error) {
            logError('parseImportTarget', error);
            return null;
        }
    }

    async function fetchSourceHtml(url, sourceLabel) {
        logDebug('fetchSourceHtml', `开始获取 ${sourceLabel} 页面: ${url}`);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'include'
            });

            logDebug('fetchSourceHtml', `响应状态: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorDetails = {
                    status: response.status,
                    statusText: response.statusText,
                    url: url
                };
                
                if (response.status === 401 || response.status === 403) {
                    throw createImportError(
                        `${sourceLabel}页面访问被拒绝，请先登录 LeetCode`,
                        {
                            ...errorDetails,
                            reason: 'ACCESS_DENIED',
                            possibleSolutions: [
                                '请在浏览器中登录 LeetCode 账号',
                                '该学习计划可能需要会员权限',
                                '请确认该链接是否公开可访问'
                            ]
                        }
                    );
                }
                
                if (response.status === 404) {
                    throw createImportError(
                        `${sourceLabel}页面不存在（404）`,
                        {
                            ...errorDetails,
                            reason: 'PAGE_NOT_FOUND',
                            possibleSolutions: [
                                '请检查链接是否正确',
                                '该学习计划或讨论帖可能已被删除'
                            ]
                        }
                    );
                }

                throw createImportError(
                    `${sourceLabel}页面请求失败：${response.status} ${response.statusText}`,
                    {
                        ...errorDetails,
                        reason: 'REQUEST_FAILED',
                        possibleSolutions: [
                            '请检查网络连接',
                            '请稍后重试',
                            'LeetCode 服务可能暂时不可用'
                        ]
                    }
                );
            }

            const html = await response.text();
            logDebug('fetchSourceHtml', `获取成功，HTML 长度: ${html.length}`);
            
            if (html.length < 1000) {
                logDebug('fetchSourceHtml', `HTML 内容较短，可能是重定向或错误页面`);
                logDebug('fetchSourceHtml', `内容预览: ${html.substring(0, 500)}`);
            }

            return html;
        } catch (error) {
            if (error.code === 'import_error') {
                throw error;
            }
            
            logError('fetchSourceHtml', error);
            
            const errorMessage = error?.message || '未知网络错误';
            
            if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
                throw createImportError(
                    `${sourceLabel}页面网络请求失败`,
                    {
                        reason: 'NETWORK_ERROR',
                        originalError: errorMessage,
                        possibleSolutions: [
                            '请检查网络连接',
                            'LeetCode 可能阻止了跨域请求',
                            '请尝试在 LeetCode 页面打开后刷新再导入'
                        ]
                    }
                );
            }

            throw createImportError(
                `获取${sourceLabel}页面失败：${errorMessage}`,
                {
                    reason: 'FETCH_EXCEPTION',
                    originalError: errorMessage
                }
            );
        }
    }

    function buildStudyPlanItems(detail, planConfig) {
        logDebug('buildStudyPlanItems', `开始从学习计划详情构建题目列表`);
        
        const groups = Array.isArray(detail?.planSubGroups) 
            ? detail.planSubGroups 
            : (Array.isArray(detail?.subGroups) ? detail.subGroups : []);
        
        logDebug('buildStudyPlanItems', `找到 ${groups.length} 个分组`);
        
        if (!groups.length) {
            const questions = Array.isArray(detail?.questions) ? detail.questions : [];
            if (questions.length > 0) {
                logDebug('buildStudyPlanItems', `在 detail.questions 找到 ${questions.length} 个题目（无分组）`);
                
                let order = 0;
                const items = [];
                
                questions.forEach((question) => {
                    const titleSlug = String(question?.titleSlug || '').toLowerCase();
                    if (!titleSlug) return;

                    order += 1;
                    items.push({
                        canonicalId: `leet:${titleSlug}`,
                        frontendQuestionId: question.questionFrontendId || question.frontendQuestionId || question.id || '',
                        titleSlug,
                        title: question.title || '',
                        translatedTitle: question.translatedTitle || question.title || titleSlug,
                        difficulty: question.difficulty || 'UNKNOWN',
                        url: buildStudyPlanQuestionUrl(titleSlug, planConfig),
                        baseUrl: buildProblemBaseUrl(titleSlug, planConfig.problemOrigin),
                        order,
                        sourceContext: {
                            envType: planConfig.envType,
                            envId: planConfig.envId,
                            planSlug: planConfig.planSlug
                        },
                        sourceSection: null,
                        topics: Array.isArray(question.topicTags)
                            ? question.topicTags.map((tag) => tag?.slug).filter(Boolean)
                            : []
                    });
                });
                
                logDebug('buildStudyPlanItems', `构建了 ${items.length} 个题目项`);
                return items;
            }
            
            logError('buildStudyPlanItems', `未找到任何题目分组或题目列表`);
            logDebug('buildStudyPlanItems', `detail 对象 keys: ${Object.keys(detail || {}).join(', ')}`);
            
            throw createImportError(
                `${planConfig.title}页面未返回题目列表`,
                {
                    reason: 'NO_QUESTIONS_FOUND',
                    availableKeys: Object.keys(detail || {}),
                    possibleSolutions: [
                        '该学习计划可能是空的',
                        'LeetCode 可能更新了数据结构',
                        '请确认该学习计划是否有题目'
                    ]
                }
            );
        }

        let order = 0;
        const items = [];
        
        groups.forEach((group, groupIndex) => {
            const questions = Array.isArray(group?.questions) ? group.questions : [];
            const sourceSection = group?.name ? {
                kind: 'studyplan_subgroup',
                id: group.slug || `studyplan-group-${groupIndex + 1}`,
                label: group.name,
                order: groupIndex + 1
            } : null;

            logDebug('buildStudyPlanItems', `分组 "${group?.name || groupIndex}" 有 ${questions.length} 个题目`);

            questions.forEach((question) => {
                const titleSlug = String(question?.titleSlug || '').toLowerCase();
                if (!titleSlug) return;

                order += 1;
                items.push({
                    canonicalId: `leet:${titleSlug}`,
                    frontendQuestionId: question.questionFrontendId || question.frontendQuestionId || question.id || '',
                    titleSlug,
                    title: question.title || '',
                    translatedTitle: question.translatedTitle || question.title || titleSlug,
                    difficulty: question.difficulty || 'UNKNOWN',
                    url: buildStudyPlanQuestionUrl(titleSlug, planConfig),
                    baseUrl: buildProblemBaseUrl(titleSlug, planConfig.problemOrigin),
                    order,
                    sourceContext: {
                        envType: planConfig.envType,
                        envId: planConfig.envId,
                        planSlug: planConfig.planSlug
                    },
                    sourceSection,
                    topics: Array.isArray(question.topicTags)
                        ? question.topicTags.map((tag) => tag?.slug).filter(Boolean)
                        : []
                });
            });
        });

        logDebug('buildStudyPlanItems', `总共构建了 ${items.length} 个题目项`);

        if (items.length === 0) {
            throw createImportError(
                `${planConfig.title}页面未返回任何题目`,
                {
                    reason: 'EMPTY_QUESTION_LIST',
                    groupCount: groups.length,
                    possibleSolutions: [
                        '该学习计划可能是空的',
                        '请确认该学习计划是否有题目'
                    ]
                }
            );
        }

        return items;
    }

    async function importStudyPlan(target) {
        const { planConfig } = target;
        
        logDebug('importStudyPlan', `开始导入学习计划: ${planConfig.title}`);
        logDebug('importStudyPlan', `URL: ${planConfig.sourceUrl}`);

        try {
            const html = await fetchSourceHtml(planConfig.sourceUrl, planConfig.title);
            const nextData = parseNextData(html, planConfig.title);
            const detail = resolveStudyPlanDetail(nextData, planConfig.title);

            const now = new Date().toISOString();
            const items = buildStudyPlanItems(detail, planConfig);

            const result = {
                listId: planConfig.listId,
                sourceType: planConfig.sourceType,
                sourceUrl: planConfig.sourceUrl,
                title: detail?.name || planConfig.title,
                site: planConfig.site || 'leetcode.cn',
                importedAt: now,
                updatedAt: now,
                items
            };

            logDebug('importStudyPlan', `导入成功，共 ${items.length} 个题目`);
            return result;
        } catch (error) {
            logError('importStudyPlan', error);
            
            if (error.code === 'import_error') {
                throw error;
            }
            
            throw createImportError(
                `导入学习计划失败：${error?.message || '未知错误'}`,
                {
                    reason: 'IMPORT_FAILED',
                    originalError: error?.message,
                    possibleSolutions: [
                        '请检查网络连接',
                        '请确保已登录 LeetCode',
                        '请稍后重试'
                    ]
                }
            );
        }
    }

    async function importLeetcodeDiscuss(target) {
        logDebug('importLeetcodeDiscuss', `开始导入讨论帖: ${target.sourceUrl}`);
        logDebug('importLeetcodeDiscuss', `类型: ${target.type}`);

        try {
            const html = await fetchSourceHtml(target.sourceUrl, 'LeetCode 讨论题单');
            const nextData = parseNextData(html, 'LeetCode 讨论题单');
            const qaQuestion = resolveDiscussQuestion(nextData);
            const resolvedDiscussId = resolveWhitelistedDiscussId(qaQuestion?.uuid || target.discussId);
            const isWhitelistedDiscuss = Boolean(resolvedDiscussId);

            logDebug('importLeetcodeDiscuss', `讨论帖 ID: ${qaQuestion?.uuid || 'unknown'}`);
            logDebug('importLeetcodeDiscuss', `是否白名单: ${isWhitelistedDiscuss}`);

            if (target.type === 'lingshen' && !resolvedDiscussId) {
                logError('importLeetcodeDiscuss', '该讨论帖不在灵神白名单中');
                const error = new Error('该讨论帖暂不在支持范围内。当前支持灵神白名单题单、Hot100 和面试经典 150。');
                error.code = 'unsupported_list_source';
                throw error;
            }

            const content = String(qaQuestion?.content || '');
            logDebug('importLeetcodeDiscuss', `讨论帖内容长度: ${content.length}`);
            
            if (!content) {
                throw createImportError(
                    '讨论帖内容为空，暂时无法导入',
                    {
                        reason: 'EMPTY_CONTENT',
                        possibleSolutions: [
                            '该讨论帖可能已被删除',
                            '讨论帖内容可能需要登录才能查看'
                        ]
                    }
                );
            }

            const parsedItems = collectDiscussProblemItems(content);
            logDebug('importLeetcodeDiscuss', `解析到 ${parsedItems.length} 个题目`);
            
            if (!parsedItems.length) {
                throw createImportError(
                    '讨论帖未解析到可导入的题目链接',
                    {
                        reason: 'NO_PROBLEMS_FOUND',
                        possibleSolutions: [
                            '该讨论帖可能不包含 LeetCode 题目链接',
                            '题目链接格式可能不正确',
                            '请确认链接是否为 https://leetcode.cn/problems/xxx 格式'
                        ]
                    }
                );
            }

            const now = new Date().toISOString();
            const items = parsedItems.map((item, index) => {
                return {
                    canonicalId: `leet:${item.slug}`,
                    frontendQuestionId: item.frontendQuestionId,
                    titleSlug: item.slug,
                    title: item.title,
                    translatedTitle: item.title,
                    difficulty: 'UNKNOWN',
                    url: item.url,
                    baseUrl: item.url,
                    order: index + 1,
                    sourceContext: {
                        source: isWhitelistedDiscuss ? 'lingshen_discuss' : 'leetcode_discuss_post',
                        discussId: resolvedDiscussId || '',
                        postId: String(target.postId || '').trim()
                    },
                    sourceSection: null,
                    topics: []
                };
            });

            if (isWhitelistedDiscuss) {
                const normalizedDiscussId = String(resolvedDiscussId || '').toLowerCase();
                const result = {
                    listId: `lc-cn:discuss:${normalizedDiscussId}`,
                    sourceType: 'leetcode_discuss',
                    sourceUrl: `https://leetcode.cn/circle/discuss/${resolvedDiscussId}/`,
                    title: String(qaQuestion?.title || '').trim() || `灵神题单 ${resolvedDiscussId}`,
                    site: 'leetcode.cn',
                    importedAt: now,
                    updatedAt: now,
                    items
                };
                logDebug('importLeetcodeDiscuss', `导入成功，共 ${items.length} 个题目`);
                return result;
            }

            const normalizedPostId = String(target.postId || '').trim();
            const result = {
                listId: `lc-cn:post:${normalizedPostId}`,
                sourceType: 'leetcode_discuss_post',
                sourceUrl: target.sourceUrl,
                title: String(qaQuestion?.title || '').trim() || `LeetCode 讨论题单 ${normalizedPostId}`,
                site: 'leetcode.cn',
                importedAt: now,
                updatedAt: now,
                items
            };
            
            logDebug('importLeetcodeDiscuss', `导入成功，共 ${items.length} 个题目`);
            return result;
        } catch (error) {
            logError('importLeetcodeDiscuss', error);
            
            if (error.code === 'import_error' || error.code === 'unsupported_list_source') {
                throw error;
            }
            
            throw createImportError(
                `导入讨论帖失败：${error?.message || '未知错误'}`,
                {
                    reason: 'IMPORT_FAILED',
                    originalError: error?.message
                }
            );
        }
    }

    function match(url) {
        const result = Boolean(parseImportTarget(url));
        logDebug('match', `URL: ${url}, 匹配结果: ${result}`);
        return result;
    }

    async function importFromUrl(url) {
        logDebug('importFromUrl', `开始从 URL 导入: ${url}`);
        
        const target = parseImportTarget(url);
        if (!target) {
            logError('importFromUrl', `URL 格式不支持: ${url}`);
            throw createImportError(
                '该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。',
                {
                    reason: 'UNSUPPORTED_URL',
                    url: url,
                    supportedFormats: [
                        '学习计划: https://leetcode.cn/studyplan/xxx/',
                        '灵神白名单讨论帖: https://leetcode.cn/circle/discuss/xxx/',
                        '普通讨论帖: https://leetcode.cn/discuss/post/xxx/'
                    ]
                }
            );
        }

        logDebug('importFromUrl', `解析到目标类型: ${target.type}`);

        if (target.type === 'studyplan') {
            return importStudyPlan(target);
        }
        if (target.type === 'lingshen' || target.type === 'leetcode_post') {
            return importLeetcodeDiscuss(target);
        }

        throw createImportError(
            '该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。',
            {
                reason: 'UNKNOWN_TARGET_TYPE',
                type: target.type
            }
        );
    }

    modules.importers = modules.importers || {};
    modules.importers.hot100 = {
        match,
        importFromUrl,
        parseImportTarget,
        parseNextData,
        resolveStudyPlanDetail,
        collectDiscussProblemItems
    };
})();
