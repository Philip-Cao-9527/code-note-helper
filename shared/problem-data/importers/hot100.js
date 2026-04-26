/**
 * 题单导入器（Hot100 / 面试经典150 / 灵神白名单题单）
 * 版本：1.1.2
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
        const source = String(content || '');
        const candidates = [];
        const occupiedRanges = [];
        const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/leetcode\.(?:cn|com)\/problems\/[^)\s]+)\)/gi;
        let markdownMatch;
        while ((markdownMatch = markdownLinkRegex.exec(source))) {
            const meta = extractProblemLinkMeta(markdownMatch[2]);
            if (!meta) continue;
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

        const urlRegex = /https?:\/\/leetcode\.(?:cn|com)\/problems\/[^\s)"'<>]+/gi;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(source))) {
            const overlap = occupiedRanges.some(([start, end]) => urlMatch.index >= start && urlMatch.index < end);
            if (overlap) continue;
            const meta = extractProblemLinkMeta(urlMatch[0]);
            if (!meta) continue;
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

        return Array.from(entries.values()).map((entry) => {
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
    }

    function parseImportTarget(url) {
        try {
            const urlObject = new URL(String(url || '').trim());
            const normalizedHost = helpers.normalizeHost(urlObject.hostname);

            const pathname = normalizePath(urlObject.pathname);
            const studyPlanMatch = pathname.match(/^\/studyplan\/([^/]+)$/);
            if (studyPlanMatch) {
                if (!STUDY_PLAN_SUPPORTED_HOSTS.has(normalizedHost)) {
                    return null;
                }
                const planSlug = String(studyPlanMatch[1] || '').toLowerCase();
                const planConfig = STUDY_PLAN_CONFIGS[planSlug];
                if (!planConfig) return null;
                const origin = resolveLeetCodeOrigin(normalizedHost);
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

            if (normalizedHost !== 'leetcode.cn') {
                return null;
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
                    type: 'leetcode_post',
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
            site: planConfig.site || 'leetcode.cn',
            importedAt: now,
            updatedAt: now,
            items: buildStudyPlanItems(detail, planConfig)
        };
    }

    async function importLeetcodeDiscuss(target) {
        const html = await fetchSourceHtml(target.sourceUrl, 'LeetCode 讨论题单');
        const nextData = parseNextData(html, 'LeetCode 讨论题单');
        const qaQuestion = resolveDiscussQuestion(nextData);
        const resolvedDiscussId = resolveWhitelistedDiscussId(qaQuestion?.uuid || target.discussId);
        const isWhitelistedDiscuss = Boolean(resolvedDiscussId);

        if (target.type === 'lingshen' && !resolvedDiscussId) {
            const error = new Error('该讨论帖暂不在支持范围内。当前支持灵神白名单题单、Hot100 和面试经典 150。');
            error.code = 'unsupported_list_source';
            throw error;
        }

        const content = String(qaQuestion?.content || '');
        if (!content) {
            throw new Error('讨论帖内容为空，暂时无法导入');
        }

        const parsedItems = collectDiscussProblemItems(content);
        if (!parsedItems.length) {
            throw new Error('讨论帖未解析到可导入的题目链接');
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

        const normalizedPostId = String(target.postId || '').trim();
        return {
            listId: `lc-cn:post:${normalizedPostId}`,
            sourceType: 'leetcode_discuss_post',
            sourceUrl: target.sourceUrl,
            title: String(qaQuestion?.title || '').trim() || `LeetCode 讨论题单 ${normalizedPostId}`,
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
        if (target.type === 'lingshen' || target.type === 'leetcode_post') {
            return importLeetcodeDiscuss(target);
        }

        throw new Error('该 URL 暂时不支持导入。当前支持 Hot100、面试经典 150、灵神白名单题单（支持 circle/discuss 与 discuss/post 链接）。');
    }

    modules.importers = modules.importers || {};
    modules.importers.hot100 = {
        match,
        importFromUrl
    };
})();
