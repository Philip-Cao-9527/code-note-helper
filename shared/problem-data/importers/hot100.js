/**
 * 题单导入器（Hot100 / 面试经典150 / 灵神白名单题单）
 * 版本：1.0.61
 */

(function () {
    'use strict';

    const modules = window.NoteHelperProblemDataModules = window.NoteHelperProblemDataModules || {};
    const constants = modules.constants || {};
    const helpers = modules.helpers || {};

    const HOT100_CONFIG = constants.HOT100_CONFIG || {};
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

    function buildStudyPlanQuestionUrl(slug, planConfig) {
        return `https://leetcode.cn/problems/${slug}/description/?envType=${planConfig.envType}&envId=${planConfig.envId}`;
    }

    function buildProblemBaseUrl(slug) {
        return `https://leetcode.cn/problems/${slug}/`;
    }

    function parseNextData(html, sourceLabel) {
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(html, 'text/html');
        const dataNode = documentNode.getElementById('__NEXT_DATA__');
        if (!dataNode || !dataNode.textContent) {
            throw new Error(`未找到${sourceLabel}页面数据`);
        }

        const nextData = helpers.safeJsonParse(dataNode.textContent);
        if (!nextData) {
            throw new Error(`${sourceLabel}页面数据解析失败`);
        }

        return nextData;
    }

    function resolveStudyPlanDetail(nextData, sourceLabel) {
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (!Array.isArray(queries)) {
            throw new Error(`${sourceLabel}页面数据结构异常`);
        }

        for (const query of queries) {
            const stateData = query?.state?.data;
            if (stateData?.studyPlanV2Detail) {
                return stateData.studyPlanV2Detail;
            }
            if (stateData?.studyPlanDetail) {
                return stateData.studyPlanDetail;
            }
        }

        throw new Error(`未找到${sourceLabel}学习计划详情`);
    }

    function resolveDiscussQuestion(nextData) {
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (!Array.isArray(queries)) {
            throw new Error('灵神题单页面数据结构异常');
        }

        for (const query of queries) {
            const qaQuestion = query?.state?.data?.qaQuestion;
            if (qaQuestion) {
                return qaQuestion;
            }
        }

        throw new Error('未找到灵神题单内容');
    }

    function extractProblemSlug(rawUrl) {
        if (!rawUrl) return '';
        const source = String(rawUrl).trim().replace(/&amp;/g, '&');
        try {
            const urlObject = new URL(source);
            if (helpers.normalizeHost(urlObject.hostname) !== 'leetcode.cn') return '';

            const segments = String(urlObject.pathname || '').split('/').filter(Boolean);
            if (segments.length < 2 || segments[0] !== 'problems') return '';
            if (segments[2] === 'solutions') return '';

            const slug = String(segments[1] || '').toLowerCase();
            return /^[a-z0-9-]+$/.test(slug) ? slug : '';
        } catch (error) {
            return '';
        }
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

    function extractFrontendQuestionId(rawTitle) {
        const matchResult = String(rawTitle || '').match(/^\s*(\d+)\./);
        return matchResult ? matchResult[1] : '';
    }

    function collectDiscussProblemItems(content) {
        const titleMap = new Map();
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/leetcode\.cn\/problems\/[^)\s]+)\)/gi;
        let markdownMatch;
        while ((markdownMatch = markdownLinkRegex.exec(content))) {
            const slug = extractProblemSlug(markdownMatch[2]);
            if (!slug) continue;
            if (titleMap.has(slug)) continue;
            titleMap.set(slug, {
                title: normalizeDiscussTitle(markdownMatch[1], slug),
                frontendQuestionId: extractFrontendQuestionId(markdownMatch[1])
            });
        }

        const urlRegex = /https?:\/\/leetcode\.cn\/problems\/[^\s)"'<>]+/gi;
        const seenSlugs = new Set();
        const items = [];
        let urlMatch;
        while ((urlMatch = urlRegex.exec(content))) {
            const slug = extractProblemSlug(urlMatch[0]);
            if (!slug || seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            const titleInfo = titleMap.get(slug) || {};
            items.push({
                slug,
                title: titleInfo.title || slug,
                frontendQuestionId: titleInfo.frontendQuestionId || ''
            });
        }

        return items;
    }

    function parseImportTarget(url) {
        try {
            const urlObject = new URL(String(url || '').trim());
            if (helpers.normalizeHost(urlObject.hostname) !== 'leetcode.cn') {
                return null;
            }

            const pathname = normalizePath(urlObject.pathname);
            const studyPlanMatch = pathname.match(/^\/studyplan\/([^/]+)$/);
            if (studyPlanMatch) {
                const planSlug = String(studyPlanMatch[1] || '').toLowerCase();
                const planConfig = STUDY_PLAN_CONFIGS[planSlug];
                if (!planConfig) return null;
                return {
                    type: 'studyplan',
                    sourceUrl: planConfig.sourceUrl,
                    planConfig
                };
            }

            const discussMatch = pathname.match(/^\/circle\/discuss\/([^/]+)$/i);
            if (discussMatch) {
                const discussId = resolveWhitelistedDiscussId(discussMatch[1]);
                if (!discussId) return null;
                return {
                    type: 'lingshen',
                    discussId,
                    sourceUrl: `https://leetcode.cn/circle/discuss/${discussId}/`
                };
            }

            const discussPostMatch = pathname.match(/^\/discuss\/post\/(\d+)(?:\/[^/]+)?$/i);
            if (discussPostMatch) {
                const postId = String(discussPostMatch[1] || '').trim();
                if (!postId) return null;
                return {
                    type: 'lingshen_post',
                    postId,
                    sourceUrl: buildNormalizedUrl(urlObject, pathname)
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    async function fetchSourceHtml(url, sourceLabel) {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit'
        });

        if (!response.ok) {
            throw new Error(`${sourceLabel}页面请求失败：${response.status}`);
        }

        return response.text();
    }

    function buildStudyPlanItems(detail, planConfig) {
        const groups = Array.isArray(detail?.planSubGroups) ? detail.planSubGroups : [];
        if (!groups.length) {
            throw new Error(`${planConfig.title}页面未返回题目列表`);
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
                    baseUrl: buildProblemBaseUrl(titleSlug),
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

        return items;
    }

    async function importStudyPlan(target) {
        const { planConfig } = target;
        const html = await fetchSourceHtml(planConfig.sourceUrl, planConfig.title);
        const nextData = parseNextData(html, planConfig.title);
        const detail = resolveStudyPlanDetail(nextData, planConfig.title);

        const now = new Date().toISOString();
        return {
            listId: planConfig.listId,
            sourceType: planConfig.sourceType,
            sourceUrl: planConfig.sourceUrl,
            title: detail?.name || planConfig.title,
            site: 'leetcode.cn',
            importedAt: now,
            updatedAt: now,
            items: buildStudyPlanItems(detail, planConfig)
        };
    }

    async function importLingshenDiscuss(target) {
        const html = await fetchSourceHtml(target.sourceUrl, '灵神题单');
        const nextData = parseNextData(html, '灵神题单');
        const qaQuestion = resolveDiscussQuestion(nextData);
        const qaDiscussId = resolveWhitelistedDiscussId(qaQuestion?.uuid);
        const targetDiscussId = resolveWhitelistedDiscussId(target.discussId);
        const resolvedDiscussId = qaDiscussId || targetDiscussId;
        if (!resolvedDiscussId) {
            throw new Error('该讨论帖暂不在支持范围内。当前支持灵神白名单题单、Hot100 和面试经典 150。');
        }

        const content = String(qaQuestion?.content || '');
        if (!content) {
            throw new Error('灵神题单内容为空，暂时无法导入');
        }

        const parsedItems = collectDiscussProblemItems(content);
        if (!parsedItems.length) {
            throw new Error('灵神题单未解析到可导入的题目链接');
        }

        const now = new Date().toISOString();
        const normalizedDiscussId = String(resolvedDiscussId || '').toLowerCase();
        const items = parsedItems.map((item, index) => {
            return {
                canonicalId: `leet:${item.slug}`,
                frontendQuestionId: item.frontendQuestionId,
                titleSlug: item.slug,
                title: item.title,
                translatedTitle: item.title,
                difficulty: 'UNKNOWN',
                url: buildProblemBaseUrl(item.slug),
                baseUrl: buildProblemBaseUrl(item.slug),
                order: index + 1,
                sourceContext: {
                    source: 'lingshen_discuss',
                    discussId: resolvedDiscussId
                },
                sourceSection: null,
                topics: []
            };
        });

        return {
            listId: `lc-cn:discuss:${normalizedDiscussId}`,
            sourceType: 'leetcode_discuss',
            sourceUrl: `https://leetcode.cn/circle/discuss/${resolvedDiscussId}/`,
            title: String(qaQuestion?.title || '').trim() || `灵神题单 ${resolvedDiscussId}`,
            site: 'leetcode.cn',
            importedAt: now,
            updatedAt: now,
            items
        };
    }

    function match(url) {
        return Boolean(parseImportTarget(url));
    }

    async function importFromUrl(url) {
        const target = parseImportTarget(url);
        if (!target) {
            throw new Error('该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。');
        }

        if (target.type === 'studyplan') {
            return importStudyPlan(target);
        }
        if (target.type === 'lingshen' || target.type === 'lingshen_post') {
            return importLingshenDiscuss(target);
        }

        throw new Error('该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。');
    }

    modules.importers = modules.importers || {};
    modules.importers.hot100 = {
        match,
        importFromUrl
    };
})();
