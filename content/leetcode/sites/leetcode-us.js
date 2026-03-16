/**
 * LeetCode 笔记助手 站点适配 - leetcode.com
 * 版本：1.0.35
 */

(function () {
    'use strict';

    const SITE_CONFIG = {
        content: 'div[data-track-load="description_content"], .elfjS, .question-content',
        editorType: 'monaco',
        official: 'div[data-track-load="editorial_content"]'
    };

    function getProblemSlug() {
        const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * 获取页面标题（去掉编号前缀）
     * @returns {string} 清洗后的题目名称，如 "Two Sum"
     */
    function getProblemTitle() {
        // 尝试多个选择器以提高兼容性
        const selectors = [
            'div.text-title-large a',
            '.text-title-large',
            '[data-cy="question-title"]'
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
     * 获取LeetCode美国站点赞量最高的题解
     */
    async function fetchLeetCodeUSSolutions() {
        const slug = getProblemSlug();
        if (!slug) return [];

        const solutions = [];

        try {
            const communityQuery = `
            query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
                questionSolutions(
                    filters: {questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy}
                ) {
                    solutions {
                        id
                        title
                        post {
                            author {
                                username
                            }
                            voteCount
                        }
                    }
                }
            }`;

            const communityRes = await fetch('https://leetcode.com/graphql/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: communityQuery,
                    variables: { questionSlug: slug, skip: 0, first: 1, orderBy: 'MOST_UPVOTE' }
                })
            });

            const communityData = await communityRes.json();
            const solutionList = communityData.data?.questionSolutions?.solutions || [];

            // 获取 top 1 解题
            for (const sol of solutionList) {
                try {
                    const topicQuery = `
                    query topicData($topicId: Int!) {
                        topic(id: $topicId) {
                            title
                            post {
                                content
                                author {
                                    username
                                }
                                voteCount
                            }
                        }
                    }`;

                    const topicRes = await fetch('https://leetcode.com/graphql/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: topicQuery,
                            variables: { topicId: parseInt(sol.id) }
                        })
                    });

                    const topicData = await topicRes.json();
                    const topic = topicData.data?.topic;

                    if (topic && topic.post?.content) {
                        solutions.push({
                            title: topic.title || sol.title,
                            content: topic.post.content,
                            author: topic.post.author?.username || 'Community',
                            upvoteCount: sol.post.voteCount || 0
                        });
                    }
                } catch (e) {
                    console.warn('获取US社区题解失败:', e);
                }
            }
        } catch (e) {
            console.error('获取LeetCode US题解失败:', e);
        }

        return solutions;
    }

    /**
     * 从自定义URL获取题解（LeetCode US）
     */
    async function fetchSolutionFromUrl(url) {
        if (!url || typeof url !== 'string') return null;

        try {
            const urlObj = new URL(url.trim());
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;

            const usMatch = pathname.match(/\/problems\/[^\/]+\/solutions\/(\d+)/);

            if (hostname.includes('leetcode.com') && usMatch) {
                const topicId = parseInt(usMatch[1]);

                const topicQuery = `
                query topicData($topicId: Int!) {
                    topic(id: $topicId) {
                        title
                        post {
                            content
                            author {
                                username
                            }
                            voteCount
                        }
                    }
                }`;

                const res = await fetch('https://leetcode.com/graphql/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: topicQuery,
                        variables: { topicId: topicId }
                    })
                });

                const data = await res.json();
                const topic = data.data?.topic;

                if (topic && topic.post?.content) {
                    return {
                        title: topic.title,
                        content: topic.post.content,
                        author: topic.post.author?.username || 'Community',
                        upvoteCount: topic.post.voteCount || 0
                    };
                }
            }
        } catch (e) {
            console.error('从自定义URL获取题解失败:', e);
        }

        return null;
    }

    window.LeetCodeSites = window.LeetCodeSites || {};
    window.LeetCodeSites['leetcode.com'] = {
        name: 'LeetCode US',
        matches: (host) => host.includes('leetcode.com'),
        config: SITE_CONFIG,
        fetchOfficialSolutions: fetchLeetCodeUSSolutions,
        fetchSolutionFromUrl,
        getProblemTitle
    };
})();
