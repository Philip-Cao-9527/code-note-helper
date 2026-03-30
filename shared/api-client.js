/**
 * 共享 API 客户端
 * 版本：1.0.81
 */

(function () {
    'use strict';

    function getErrorHelper() {
        return window.NoteHelperErrorMessages || null;
    }

    function isAbortError(error) {
        const helper = getErrorHelper();
        if (helper && typeof helper.isAbortError === 'function') {
            return helper.isAbortError(error);
        }
        if (!error) return false;
        if (error.name === 'AbortError') return true;
        return /已取消|aborted|abort/i.test(String(error.message || error));
    }

    function createAbortError() {
        const error = new Error('API 调用已取消');
        error.name = 'AbortError';
        return error;
    }

    function normalizeError(error, fallbackMessage) {
        const helper = getErrorHelper();
        if (helper && typeof helper.normalizeError === 'function') {
            return helper.normalizeError(error, fallbackMessage);
        }
        return {
            isAbort: isAbortError(error),
            statusCode: Number(error && error.status) || null,
            message: String(error && error.message ? error.message : error || fallbackMessage || '请求失败')
        };
    }

    function resolveTargetUrl(url) {
        const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
        if (!cleanUrl) return '';
        if (cleanUrl.endsWith('/chat/completions')) return cleanUrl;
        if (cleanUrl.endsWith('/v1')) return `${cleanUrl}/chat/completions`;
        return `${cleanUrl}/v1/chat/completions`;
    }

    function throwIfAborted(signal) {
        if (signal && signal.aborted) {
            throw createAbortError();
        }
    }

    function createLinkedAbortController(externalSignal) {
        if (typeof AbortController !== 'function') return null;
        const controller = new AbortController();
        if (!externalSignal) return controller;
        if (externalSignal.aborted) {
            controller.abort();
            return controller;
        }
        externalSignal.addEventListener('abort', () => {
            controller.abort();
        }, { once: true });
        return controller;
    }

    function createHttpStatusError(statusCode, statusText = '') {
        const helper = getErrorHelper();
        const message = helper && typeof helper.formatStatusError === 'function'
            ? helper.formatStatusError(Number(statusCode))
            : `HTTP ${statusCode}：请求失败，请稍后重试。`;
        const error = new Error(statusText ? `${message} (${statusText})` : message);
        error.name = 'ApiHttpError';
        error.status = Number(statusCode);
        error.statusText = String(statusText || '');
        return error;
    }

    function buildRequestBody(model, prompt, stream) {
        return JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'You are a helpful coding assistant.' },
                { role: 'user', content: prompt }
            ],
            stream
        });
    }

    function normalizeHandlers(onProgress, options = {}) {
        const handlers = {
            onVisibleProgress: typeof onProgress === 'function' ? onProgress : null,
            onThinkingProgress: typeof options.onThinkingProgress === 'function' ? options.onThinkingProgress : null
        };
        return handlers;
    }

    function createThinkTagFilter() {
        const OPEN_TAG = '<think>';
        const CLOSE_TAG = '</think>';
        const OPEN_TAIL = OPEN_TAG.length;
        const CLOSE_TAIL = CLOSE_TAG.length;

        let inThink = false;
        let carry = '';

        function takeSafePrefix(text, tailSize) {
            if (!text) return { head: '', rest: '' };
            const safeLen = Math.max(0, text.length - tailSize);
            return {
                head: text.slice(0, safeLen),
                rest: text.slice(safeLen)
            };
        }

        function consume(chunk) {
            let text = `${carry}${String(chunk || '')}`;
            carry = '';
            let visiblePart = '';
            let thinkingPart = '';

            while (text) {
                if (inThink) {
                    const closeIndex = text.indexOf(CLOSE_TAG);
                    if (closeIndex === -1) {
                        const { head, rest } = takeSafePrefix(text, CLOSE_TAIL - 1);
                        thinkingPart += head;
                        carry = rest;
                        break;
                    }
                    thinkingPart += text.slice(0, closeIndex);
                    text = text.slice(closeIndex + CLOSE_TAG.length);
                    inThink = false;
                    continue;
                }

                const openIndex = text.indexOf(OPEN_TAG);
                if (openIndex === -1) {
                    const { head, rest } = takeSafePrefix(text, OPEN_TAIL - 1);
                    visiblePart += head;
                    carry = rest;
                    break;
                }

                visiblePart += text.slice(0, openIndex);
                text = text.slice(openIndex + OPEN_TAG.length);
                inThink = true;
            }

            return {
                visiblePart,
                thinkingPart
            };
        }

        function flush() {
            if (!carry) {
                return {
                    visiblePart: '',
                    thinkingPart: ''
                };
            }
            const remaining = carry;
            carry = '';
            if (inThink) {
                return {
                    visiblePart: '',
                    thinkingPart: remaining
                };
            }
            return {
                visiblePart: remaining,
                thinkingPart: ''
            };
        }

        return {
            consume,
            flush
        };
    }

    function extractVisibleFromContentNode(node) {
        if (typeof node === 'string') {
            return node;
        }
        if (Array.isArray(node)) {
            let output = '';
            node.forEach((item) => {
                if (typeof item === 'string') {
                    output += item;
                    return;
                }
                if (!item || typeof item !== 'object') return;

                const type = String(item.type || '').toLowerCase();
                if (type.includes('reason') || type.includes('think')) return;

                if (typeof item.text === 'string') {
                    output += item.text;
                    return;
                }
                if (typeof item.content === 'string') {
                    output += item.content;
                    return;
                }
                if (typeof item.value === 'string') {
                    output += item.value;
                }
            });
            return output;
        }
        if (node && typeof node === 'object') {
            if (typeof node.text === 'string') return node.text;
            if (typeof node.content === 'string') return node.content;
            if (Array.isArray(node.content)) return extractVisibleFromContentNode(node.content);
            if (typeof node.value === 'string') return node.value;
        }
        return '';
    }

    function extractThinkingFromContentNode(node) {
        if (!node) return '';
        if (typeof node === 'string') return '';

        if (Array.isArray(node)) {
            let output = '';
            node.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const type = String(item.type || '').toLowerCase();
                if (!type.includes('reason') && !type.includes('think')) return;

                if (typeof item.text === 'string') {
                    output += item.text;
                    return;
                }
                if (typeof item.content === 'string') {
                    output += item.content;
                    return;
                }
                if (typeof item.value === 'string') {
                    output += item.value;
                }
            });
            return output;
        }

        if (typeof node === 'object') {
            if (typeof node.reasoning_content === 'string') return node.reasoning_content;
            if (typeof node.reasoning === 'string') return node.reasoning;
            if (typeof node.thinking === 'string') return node.thinking;
            if (typeof node.thought === 'string') return node.thought;
        }

        return '';
    }

    function extractDeltaParts(data) {
        const choice = data && data.choices && data.choices[0] ? data.choices[0] : {};
        const delta = choice && typeof choice.delta === 'object' && choice.delta ? choice.delta : null;
        const message = choice && typeof choice.message === 'object' && choice.message ? choice.message : null;

        const source = delta || message || {};

        const visiblePart = extractVisibleFromContentNode(source.content);
        let thinkingPart = '';

        thinkingPart += extractThinkingFromContentNode(source.content);

        const reasoningCandidates = [
            source.reasoning_content,
            source.reasoning,
            source.thinking,
            source.thought,
            choice.reasoning_content,
            choice.reasoning,
            data && data.reasoning_content,
            data && data.reasoning,
            data && data.thinking,
            data && data.thought
        ];

        for (const candidate of reasoningCandidates) {
            if (typeof candidate === 'string' && candidate) {
                thinkingPart += candidate;
            }
        }

        return {
            visiblePart,
            thinkingPart
        };
    }

    function createStreamAccumulator(handlers) {
        const thinkTagFilter = createThinkTagFilter();
        let visibleText = '';
        let thinkingText = '';

        function appendThinking(rawChunk) {
            const chunk = String(rawChunk || '');
            if (!chunk) return;
            thinkingText += chunk;
            if (handlers.onThinkingProgress) {
                handlers.onThinkingProgress(thinkingText);
            }
        }

        function appendVisible(rawChunk) {
            const chunk = String(rawChunk || '');
            if (!chunk) return;
            const separated = thinkTagFilter.consume(chunk);
            if (separated.thinkingPart) {
                appendThinking(separated.thinkingPart);
            }
            if (!separated.visiblePart) return;
            visibleText += separated.visiblePart;
            if (handlers.onVisibleProgress) {
                handlers.onVisibleProgress(visibleText);
            }
        }

        function appendFromPayload(data) {
            if (!data || typeof data !== 'object') return;
            const parsed = extractDeltaParts(data);
            if (parsed.thinkingPart) {
                appendThinking(parsed.thinkingPart);
            }
            if (parsed.visiblePart) {
                appendVisible(parsed.visiblePart);
            }
        }

        function finalize() {
            const remain = thinkTagFilter.flush();
            if (remain.thinkingPart) {
                appendThinking(remain.thinkingPart);
            }
            if (remain.visiblePart) {
                visibleText += remain.visiblePart;
                if (handlers.onVisibleProgress) {
                    handlers.onVisibleProgress(visibleText);
                }
            }
            return {
                visibleText,
                thinkingText
            };
        }

        return {
            appendFromPayload,
            finalize
        };
    }

    function parseSseText(rawText, handlers) {
        const source = String(rawText || '');
        if (!source.trim()) {
            return {
                visibleText: '',
                thinkingText: ''
            };
        }

        const accumulator = createStreamAccumulator(handlers);
        const lines = source.split(/\r?\n/);

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const data = JSON.parse(payload);
                accumulator.appendFromPayload(data);
            } catch (error) {
                // SSE 片段可能含有非 JSON 行，忽略即可
            }
        }

        return accumulator.finalize();
    }

    function tryParseJsonContent(rawText, handlers) {
        const source = String(rawText || '').trim();
        if (!source) {
            return {
                visibleText: '',
                thinkingText: ''
            };
        }
        if (!source.startsWith('{') && !source.startsWith('[')) {
            return {
                visibleText: '',
                thinkingText: ''
            };
        }

        try {
            const data = JSON.parse(source);
            const accumulator = createStreamAccumulator(handlers);
            accumulator.appendFromPayload(data);
            return accumulator.finalize();
        } catch (error) {
            return {
                visibleText: '',
                thinkingText: ''
            };
        }
    }

    async function readSseStream(response, handlers) {
        if (!response.body || typeof response.body.getReader !== 'function') {
            const text = await response.text();
            const parsedFromSse = parseSseText(text, handlers);
            if (parsedFromSse.visibleText || parsedFromSse.thinkingText) {
                return parsedFromSse;
            }
            return tryParseJsonContent(text, handlers);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const accumulator = createStreamAccumulator(handlers);

        let buffer = '';
        let rawText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const decoded = decoder.decode(value, { stream: true });
            rawText += decoded;
            buffer += decoded;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || !line.startsWith('data:')) continue;

                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;

                try {
                    const data = JSON.parse(payload);
                    accumulator.appendFromPayload(data);
                } catch (error) {
                    // JSON 可能被拆到下一段，继续等待即可
                }
            }
        }

        if (buffer.trim()) {
            const lines = buffer.split(/\r?\n/);
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || !line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    const data = JSON.parse(payload);
                    accumulator.appendFromPayload(data);
                } catch (error) {
                    // 末尾残片不是完整 JSON 时忽略，稍后走 JSON 回退。
                }
            }
        }

        const finalized = accumulator.finalize();
        if (finalized.visibleText || finalized.thinkingText) {
            return finalized;
        }

        return tryParseJsonContent(rawText || buffer, handlers);
    }

    function ensureMessagingAvailable() {
        if (!window.Messaging || typeof window.Messaging.fetch !== 'function') {
            throw new Error('Messaging.fetch 不可用');
        }
    }

    async function callAI(url, key, model, prompt, onProgress, options = {}) {
        const targetUrl = resolveTargetUrl(url);
        if (!targetUrl) {
            throw new Error('接口地址不能为空，请检查 API URL 配置。');
        }

        const handlers = normalizeHandlers(onProgress, options);
        const useStream = Boolean(handlers.onVisibleProgress || handlers.onThinkingProgress);

        const externalSignal = options && options.signal;
        throwIfAborted(externalSignal);

        if (useStream) {
            try {
                const linkedController = createLinkedAbortController(externalSignal);
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: buildRequestBody(model, prompt, true),
                    signal: linkedController ? linkedController.signal : externalSignal,
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw createHttpStatusError(response.status, response.statusText);
                }

                const streamResult = await readSseStream(response, handlers);
                if (streamResult.visibleText) {
                    return streamResult.visibleText;
                }
            } catch (fetchError) {
                if (isAbortError(fetchError)) {
                    throw createAbortError();
                }
                if (fetchError && fetchError.status) {
                    throw fetchError;
                }
                throwIfAborted(externalSignal);
                console.warn('[ApiClient] 直连流式失败，回退到 Messaging:', fetchError);
            }
        }

        try {
            throwIfAborted(externalSignal);
            ensureMessagingAvailable();
            const response = await window.Messaging.fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: buildRequestBody(model, prompt, useStream),
                stream: useStream
            });
            throwIfAborted(externalSignal);

            if (!response.ok) {
                throw createHttpStatusError(response.status);
            }

            if (useStream && typeof response.data === 'string') {
                const streamed = parseSseText(response.data, handlers);
                if (streamed.visibleText) {
                    return streamed.visibleText;
                }
            }

            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            const directPayload = extractDeltaParts(data);
            const fullContent = directPayload.visiblePart || '';
            if (!fullContent) {
                throw new Error('接口未返回有效内容，请稍后重试。');
            }

            if (handlers.onThinkingProgress && directPayload.thinkingPart) {
                handlers.onThinkingProgress(directPayload.thinkingPart);
            }
            if (handlers.onVisibleProgress) {
                handlers.onVisibleProgress(fullContent);
            }
            return fullContent;
        } catch (error) {
            if (isAbortError(error)) {
                throw createAbortError();
            }

            if (error && error.status) {
                throw error;
            }

            const normalized = normalizeError(error, 'API 调用失败，请稍后重试。');
            const wrapped = new Error(normalized.message);
            if (normalized.statusCode) {
                wrapped.status = normalized.statusCode;
            }
            throw wrapped;
        }
    }

    window.NoteHelperApiClient = {
        callAI,
        isAbortError,
        resolveTargetUrl
    };

    window.ApiClient = window.NoteHelperApiClient;
})();
