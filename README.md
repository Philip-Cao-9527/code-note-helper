<div align="center">

# CodeNote Helper

**算法刷题笔记 · 深度学习复盘 · AI 对话时间轴**

一个 Chrome / Edge 浏览器扩展，让代码刷题、复盘、记笔记这件事变得不再繁琐。

![Version](https://img.shields.io/badge/version-1.0.70-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-brightgreen)

[功能亮点](#-功能亮点) · [快速开始](#-快速开始) · [使用指南](#-使用指南) · [API 配置](#-api-配置) · [English](#-english)

</div>

---

## 😩 这些场景你一定经历过

**刷力扣的时候：**
- 做完一道题想让 AI 帮忙讲讲思路，结果要先复制题目描述，再复制自己的代码，再找到参考题解复制过去，来来回回折腾好几分钟才问出一个问题
- 好不容易看完了题解，代码能看懂，但就是不明白「为什么要这样想」「这一步的关键思路是什么」
- 写完代码提交了，想知道自己的做法到底好不好，AI 却只会说「思路不错」，说了等于没说
- 刷了两百多道题，过一个月回头看，发现大部分都忘了——因为刷的时候根本没有留下任何能用来复习的东西

**准备深度学习手撕代码的时候：**
- Attention、BatchNorm、CrossEntropy……考前每个都手撕了一遍，考完全忘了，下次还是从零开始
- 在 TorchCode 或 Deep-ML 上练完一道题，想用 AI 帮忙做个复盘笔记，又得重复那套「复制题目 → 复制代码 → 粘贴给 AI」的流程

**和 AI 长时间对话的时候：**
- 一个题单三十多道题都在同一个对话里问，聊到后面对话窗口已经几十屏了，想找之前某道题的回答只能不停地翻页
- 回顾之前的关键回答？滚动到手酸也不一定找得到

**CodeNote Helper 要做的，就是把这些重复的、低效的环节自动化掉，让你专注在理解和学习本身。**

---

## ✨ 功能亮点

### 📝 算法刷题笔记助手

> 在 LeetCode / CodeFun2000 题目页面自动启用

- **一键生成结构化笔记** —— 自动抓取题目描述、你写的代码、参考题解，交给 AI 生成包含思路分析、逐行代码讲解、复杂度分析的完整 Markdown 笔记
- **对你的代码做真正有用的评价** —— 不是敷衍的「思路正确」，而是针对你的实现逐段分析优缺点、给出评分和具体的改进方向
- **灵神题解优先推荐** —— 自动识别灵茶山艾府的题解并置顶作为推荐方案，帮你直接学习高质量解法
- **三种使用方式** —— 复制 Prompt 粘贴到任意 AI 对话、直连 API 在页面内直接生成、一键跳转到 ChatGPT / Claude / Gemini / DeepSeek
- **直连 API 流式输出** —— 配置好 API 后可以在题目页面内直接生成笔记，支持实时流式响应，生成过程所见即所得
- **题单进度追踪** —— 支持导入 Hot100、面试经典 150、灵神题单，自动追踪每道题的做题状态，全部完成时还有烟花庆祝 🎆
- **独立笔记本** —— 内置双栏 Markdown 编辑器，实时预览、公式渲染、一键导出，所有笔记集中管理

### 📝 深度学习笔记助手

> 在 Deep-ML / TorchCode 页面自动启用

- **面向 Notebook 的复盘笔记** —— 自动读取当前题目、你的实现代码和内置参考实现目录，生成结构化的深度学习笔记
- **题型智能分流** —— 自动识别 Attention、Normalization、Training Loop 等题型，生成对应的检查清单和面试深挖方向
- **支持 Deep-ML + TorchCode** —— 兼容 `deep-ml.com/problems/*` 题目页和 TorchCode Hugging Face Space 工作区
- **与算法笔记共享数据体系** —— 保存的深度学习笔记复用同一套本地记录和同步机制，统一管理

### ⏱️ AI 对话时间轴

> 在 ChatGPT / Gemini / Claude 页面自动启用

- **可视化时间轴** —— 在对话页面右侧生成时间轴导航条，整段对话的结构一目了然
- **点击跳转** —— 点击任意节点直接滚动到对应的消息位置，告别无尽翻页
- **星标收藏** —— 长按节点标记为 ⭐️，把重要的回答钉在时间轴上，随时回看
- **悬停预览** —— 鼠标悬停在节点上可以直接预览消息内容，不用跳转就能快速确认
- **高性能渲染** —— 基于虚拟滑动窗口，100+ 轮的超长对话也能流畅渲染
- **深色模式适配** —— 自动跟随网站的深色 / 浅色主题切换

---

## 🚀 快速开始

### 安装

1. **下载代码** —— 克隆或下载本仓库到本地

```bash
git clone https://github.com/Philip-Cao-9527/code-note-helper.git
```

2. **打开扩展管理页面**
   - Chrome: 地址栏输入 `chrome://extensions/`
   - Edge: 地址栏输入 `edge://extensions/`

3. **开启开发者模式** —— 打开页面右上角的「开发者模式」开关

4. **加载扩展** —— 点击「加载已解压的扩展程序」，选择下载的项目文件夹

5. **开始使用** 🎉 —— 工具栏会出现扩展图标，打开任意 LeetCode 题目页面即可看到右下角的 📝 按钮

---

## 📖 使用指南

### 1. 算法刷题笔记

打开任意 LeetCode / CodeFun2000 题目页面，点击右下角的紫色 📝 悬浮按钮：

1. **输入笔记标题**（支持自动获取当前题目名称）
2. **选择代码水平**（小白 / 熟练 / 专家）—— AI 会根据你的水平调整讲解的深度和详细程度
3. **选择生成方式**：
   - 🔗 **复制 Prompt** → 粘贴到你习惯的 AI 对话中使用
   - ⭐ **直连 API** → 配置好 API 后，在页面内直接生成笔记
   - 🚀 **跳转平台** → 一键跳转到 ChatGPT / Claude / Gemini / DeepSeek
4. **生成完成后** —— 可以复制结果，也可以保存到本地笔记本

> 💡 **自定义题解**：支持输入任意 LeetCode 题解 URL，自动抓取并整合到笔记中。如果检测到灵神的题解，会自动置顶推荐。

### 2. 深度学习笔记

打开 Deep-ML 题目页面或 TorchCode HuggingFace Space 工作区，同样点击右下角的 📝 按钮即可使用，操作流程与算法笔记一致。

### 3. AI 对话时间轴

打开 ChatGPT / Gemini / Claude 的对话页面，右侧会自动出现时间轴导航条：

- **单击** 节点 → 跳转到对应消息
- **长按** 节点 → 标记为星标 ⭐️
- **悬停** 节点 → 预览消息内容

> 如果不需要时间轴，可以在扩展设置页中关闭。

### 4. 题单进度追踪

点击扩展图标打开 Popup，切换到「题单」视图：

- 支持导入 **Hot100**、**面试经典 150**、**灵神题单**（通过粘贴题单 URL 导入）
- 每道题的做题状态会自动同步更新
- 全部完成一个题单后，会触发烟花庆祝动画 🎆

### 5. 数据同步与备份

所有数据默认保存在浏览器本地，不联网也能正常使用。如果你需要在多台设备之间同步数据，可以选择以下方式：

- **Cloud Sync** —— 基于浏览器自带的同步服务进行轻量级同步。适合日常使用，大约可以保存 150 条左右的笔记记录。不需要额外配置账号，只要浏览器登录了同步账户就能用。
- **坚果云 WebDAV** —— 完整备份方案，会将所有数据（记录、题单、笔记内容等）打包上传到你的坚果云 WebDAV 空间。没有条数限制，适合数据量较大或需要完整备份恢复的场景。默认备份路径为 `CodeNote-Helper/backups/full-backup.json`。
- **JSON 导入 / 导出** —— 最简单的备份方式，手动导出一份 JSON 文件保存到本地，需要时随时导入恢复。适合不想配置云同步、偶尔手动备份一下的用户。

> 以上同步选项均在扩展设置页（Popup → 设置与同步）中配置，默认全部关闭，按需开启即可。

---

## ⚙️ API 配置

如果你选择「直连 API」模式，需要在设置页填写 API 信息。扩展支持所有兼容 OpenAI 接口格式的 API（如 DeepSeek、Moonshot、各类中转站等）。

### 参考配置（ChatAnyWhere 中转站）

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://api.chatanywhere.tech/v1` |
| Model | `deepseek-v3.2`（或中转站支持的其他模型） |
| API Key | 你的 ChatAnyWhere Key（`sk-...`） |

> 参考：https://github.com/chatanywhere/GPT_API_free

### 常见问题

**API 返回 404 / Invalid URL？**
- ✅ 正确格式：`https://api.openai.com/v1`
- ❌ 错误格式：`https://api.openai.com/v1/chat/completions`（扩展会自动拼接 `/chat/completions`，不要手动写全）

**按钮 / 时间轴没出现？**
- 刷新一下页面试试。如果还是没有，检查一下扩展设置页中对应功能是否已启用。

**TorchCode 页面没有按钮？**
- 确认你已经进入了具体的 notebook 页面，而不是停留在 Hugging Face Space 的介绍页。

---

## 🌐 支持站点

| 站点 | 功能 |
|------|------|
| [LeetCode 中国站](https://leetcode.cn/problems/) | 算法刷题笔记 |
| [LeetCode 国际站](https://leetcode.com/problems/) | 算法刷题笔记 |
| [CodeFun2000](https://codefun2000.com/) | 算法刷题笔记 |
| [Deep-ML](https://www.deep-ml.com/problems/) | 深度学习笔记 |
| [TorchCode HuggingFace Space](https://huggingface.co/spaces/duoan/TorchCode) | 深度学习笔记 |
| [ChatGPT](https://chatgpt.com/) | AI 对话时间轴 |
| [Gemini](https://gemini.google.com/) | AI 对话时间轴 |
| [Claude](https://claude.ai/) | AI 对话时间轴 |

---

## 🔒 隐私声明

- 默认情况下，所有数据保存在浏览器本地，**不会发送到任何开发者服务器**
- Cloud Sync 和坚果云备份是可选功能，数据只会同步到**你自己的**浏览器同步账户或 WebDAV 空间
- 如果使用直连 API，数据仅发送到**你自己配置的**模型接口

详见 [PRIVACY POLICY.md](./PRIVACY%20POLICY.md)

---

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！

- 🐛 [报告 Bug](https://github.com/Philip-Cao-9527/code-note-helper/issues)
- 💡 [功能建议](https://github.com/Philip-Cao-9527/code-note-helper/issues)

---

## 📜 License

[MIT License](./LICENSE) © 2026 cao

---

<a name="-english"></a>

## 🇬🇧 English

**CodeNote Helper** is a Chrome/Edge extension that takes the repetitive busywork out of studying algorithms and deep learning — no more copy-pasting problems, code, and solutions back and forth just to ask AI a question.

### What it does

- **Algorithm Note Helper** — Auto-extracts problem descriptions, your code, and reference solutions from LeetCode / CodeFun2000, then generates structured Markdown study notes via AI. Supports one-click prompt copy, direct API generation, and smart solution recommendation (with priority for top community contributors).
- **Deep Learning Note Helper** — Same workflow for TorchCode notebooks and Deep-ML problems. Auto-detects task types (Attention, Normalization, Training Loop, etc.) and generates targeted review notes with interview-oriented analysis.
- **AI Chat Timeline** — Adds a visual navigation timeline to ChatGPT / Gemini / Claude conversations. Click to jump, long-press to bookmark, hover to preview — no more endless scrolling through 50+ turns of dialogue.

### Quick Start

```bash
git clone https://github.com/Philip-Cao-9527/code-note-helper.git
```

1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the project folder
4. Open any LeetCode problem page → click the 📝 button

### API Configuration

Supports any OpenAI-compatible API. Example proxy: [ChatAnyWhere](https://github.com/chatanywhere/GPT_API_free)

| Setting | Value |
|---------|-------|
| Base URL | `https://api.chatanywhere.tech/v1` |
| Model | `deepseek-v3.2` |
| API Key | Your key (`sk-...`) |

### Privacy

All data stays in your local browser by default. Cloud sync (Cloud Sync / Nutstore WebDAV) and API calls are optional — they only connect to services you configure yourself. No data is collected or sent to any developer server. See [PRIVACY POLICY.md](./PRIVACY%20POLICY.md).

### License

[MIT](./LICENSE) © 2026 cao
