/**
 * 消息通信封装
 * 内容脚本与 Service Worker 通信
 */

const Messaging = {
    /**
     * 发送消息到 Service Worker
     * @param {string} type 消息类型
     * @param {Object} data 消息数据
     * @returns {Promise<*>}
     */
    async send(type, data = {}) {
        try {
            const response = await chrome.runtime.sendMessage({ type, ...data });
            if (response && response.error) {
                throw new Error(response.error);
            }
            return response;
        } catch (e) {
            console.error('[Messaging] 发送失败:', type, e);
            throw e;
        }
    },

    /**
     * 跨域 Fetch 请求（通过 Service Worker 代理）
     * @param {string} url 请求 URL
     * @param {Object} options fetch 选项
     * @returns {Promise<Object>}
     */
    async fetch(url, options = {}) {
        return this.send('FETCH_REQUEST', { url, options });
    },

    /**
     * 打开新标签页
     * @param {string} url 目标 URL
     * @param {boolean} active 是否激活
     * @returns {Promise<Object>}
     */
    async openTab(url, active = true) {
        return this.send('OPEN_TAB', { url, active });
    },

    /**
     * 获取 Monaco 编辑器代码（通过 MAIN world 执行）
     * @returns {Promise<{success: boolean, code?: string, error?: string}>}
     */
    async getMonacoCode() {
        return this.send('GET_MONACO_CODE');
    }
};

// 导出到全局（内容脚本使用）
if (typeof window !== 'undefined') {
    window.Messaging = Messaging;
}
