/**
 * LeetCode 笔记助手 站点适配 - leetcode.cn
 * 版本：1.0.35
 */

(function () {
    'use strict';

    const SITE_CONFIG = {
        content: '[data-cy="question-content"], .elfjS, .question-content',
        editorType: 'monaco',
        official: '[data-cy="question-solution"]'
    };

    function getProblemSlug() {
        const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * 获取页面标题（去掉编号前缀）
     * @returns {string} 清洗后的题目名称，如 "两数之和"
     */
    function getProblemTitle() {
        // 尝试多个选择器以提高兼容性（中国站和美国站选择器相似）
        const selectors = [
            'div.text-title-large a',
            '.text-title-large',
            '[data-cy="question-title"]',
            'div[data-track-load="title"] a'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const rawTitle = el.textContent.trim();
                // 去掉编号前缀：匹配 "123." 或 "123. " 开头
                return rawTitle.replace(/^\d+\.\s*/, '');
            }
        }
        return '';
    }

    /**
     * 获取LeetCode中国站题解 - 优先获取灵茶山艾府(endlesscheng)的题解
     */
    async function fetchLeetCodeCNSolutions() {
        const slug = getProblemSlug();
        if (!slug) return [];

        const solutions = [];

        try {
            // 1. 获取题解列表（按点赞量排序，取前20个以增加命中灵神的概率）
            const listQuery = `
            query questionSolutionArticles($questionSlug: String!, $first: Int, $skip: Int, $orderBy: SolutionArticleOrderBy) {
                questionSolutionArticles(questionSlug: $questionSlug, first: $first, skip: $skip, orderBy: $orderBy) {
                    edges {
                        node {
                            slug
                            title
                            author {
                                username
                            }
                            upvoteCount
                        }
                    }
                }
            }`;

            const listRes = await fetch('https://leetcode.cn/graphql/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: listQuery,
                    variables: { questionSlug: slug, first: 20, skip: 0, orderBy: 'MOST_UPVOTE' }
                })
            });

            const listData = await listRes.json();
            const edges = listData.data?.questionSolutionArticles?.edges || [];

            // 2. 筛选逻辑：优先获取 endlesscheng (灵茶山艾府) + 1个高赞
            const targetAuthor = 'endlesscheng';
            const endlessSolution = edges.find(e => e.node.author.username === targetAuthor);

            // 过滤掉特定作者，取剩余的前1个高赞（有灵神时共2个题解，无灵神时共1个题解）
            const otherSolutions = edges.filter(e => e.node.author.username !== targetAuthor).slice(0, 1);

            const solutionsToFetch = [];
            if (endlessSolution) {
                solutionsToFetch.push(endlessSolution); // 灵神题解放第一位
            }
            solutionsToFetch.push(...otherSolutions);

            // 3. 获取每个题解的详细内容
            const detailQuery = `
            query solutionDetailArticle($slug: String!) {
                solutionArticle(slug: $slug) {
                    title
                    content
                    author {
                        username
                    }
                }
            }`;

            for (const sol of solutionsToFetch) {
                try {
                    const detailRes = await fetch('https://leetcode.cn/graphql/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: detailQuery,
                            variables: { slug: sol.node.slug }
                        })
                    });

                    const detailData = await detailRes.json();
                    const article = detailData.data?.solutionArticle;

                    if (article && article.content) {
                        solutions.push({
                            title: article.title,
                            content: article.content,
                            author: article.author.username,
                            upvoteCount: sol.node.upvoteCount || 0
                        });
                    }
                } catch (e) {
                    console.warn('获取题解详情失败:', e);
                }
            }
        } catch (e) {
            console.error('获取LeetCode CN题解列表失败:', e);
        }

        return solutions;
    }

    /**
     * 从自定义URL获取题解（LeetCode CN）
     */
    async function fetchSolutionFromUrl(url) {
        if (!url || typeof url !== 'string') return null;

        try {
            const urlObj = new URL(url.trim());
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            const cnMatch = pathname.match(/\/problems\/[^\/]+\/solutions\/(\d+)\/([^\/]+)/);

            if (hostname.includes('leetcode.cn') && cnMatch) {
                const solutionSlug = cnMatch[2];

                const detailQuery = `
                query solutionDetailArticle($slug: String!) {
                    solutionArticle(slug: $slug) {
                        title
                        content
                        author {
                            username
                        }
                        upvoteCount
                    }
                }`;

                const res = await fetch('https://leetcode.cn/graphql/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: detailQuery,
                        variables: { slug: solutionSlug }
                    })
                });

                const data = await res.json();
                const article = data.data?.solutionArticle;

                if (article && article.content) {
                    return {
                        title: article.title,
                        content: article.content,
                        author: article.author.username,
                        upvoteCount: article.upvoteCount || 0
                    };
                }
            }
        } catch (e) {
            console.error('从自定义URL获取题解失败:', e);
        }

        return null;
    }

    window.LeetCodeSites = window.LeetCodeSites || {};
    window.LeetCodeSites['leetcode.cn'] = {
        name: 'LeetCode CN',
        matches: (host) => host.includes('leetcode.cn'),
        config: SITE_CONFIG,
        fetchOfficialSolutions: fetchLeetCodeCNSolutions,
        fetchSolutionFromUrl,
        getProblemTitle
    };
})();
