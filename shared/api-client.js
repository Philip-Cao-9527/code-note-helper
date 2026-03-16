/**
 * 共享 API 客户端
 * 版本：1.0.47
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

    function parseSseText(rawText, onProgress) {
        const source = String(rawText || '');
        if (!source.trim()) return '';

        let fullContent = '';
        const lines = source.split(/\r?\n/);
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const data = JSON.parse(payload);
                const delta = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content || '';
                if (!delta) continue;
                fullContent += delta;
                if (typeof onProgress === 'function') {
                    onProgress(fullContent);
                }
            } catch (error) {
                // SSE 片段可能含有非 JSON 行，忽略即可
            }
        }

        return fullContent;
    }

    function tryParseJsonContent(rawText, onProgress) {
        const source = String(rawText || '').trim();
        if (!source) return '';
        if (!source.startsWith('{') && !source.startsWith('[')) return '';

        try {
            const data = JSON.parse(source);
            const fullContent = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || '';
            if (!fullContent) return '';
            if (typeof onProgress === 'function') {
                onProgress(fullContent);
            }
            return fullContent;
        } catch (error) {
            return '';
        }
    }

    async function readSseStream(response, onProgress) {
        if (!response.body || typeof response.body.getReader !== 'function') {
            const text = await response.text();
            const fromSse = parseSseText(text, onProgress);
            if (fromSse) return fromSse;
            return tryParseJsonContent(text, onProgress);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
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
                    const delta = data.choices?.[0]?.delta?.content || '';
                    if (!delta) continue;
                    fullContent += delta;
                    if (typeof onProgress === 'function') {
                        onProgress(fullContent);
                    }
                } catch (error) {
                    // JSON 可能被拆到下一段，继续等待即可
                }
            }
        }

        if (buffer.trim()) {
            const tail = parseSseText(buffer, null);
            if (tail) {
                fullContent += tail;
                if (typeof onProgress === 'function') {
                    onProgress(fullContent);
                }
            }
        }

        if (!fullContent) {
            const fromJson = tryParseJsonContent(rawText || buffer, onProgress);
            if (fromJson) return fromJson;
        }

        return fullContent;
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

        const useStream = typeof onProgress === 'function';
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

                const fullContent = await readSseStream(response, onProgress);
                if (fullContent) {
                    return fullContent;
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
                const streamed = parseSseText(response.data, onProgress);
                if (streamed) {
                    return streamed;
                }
            }

            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            const fullContent = data?.choices?.[0]?.message?.content || '';
            if (!fullContent) {
                throw new Error('接口未返回有效内容，请稍后重试。');
            }
            if (typeof onProgress === 'function') {
                onProgress(fullContent);
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
