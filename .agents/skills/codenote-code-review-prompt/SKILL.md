---
name: codenote-code-review-prompt
description: 为 CodeNote Helper 生成 code review 中文 prompt。用于审查当前 diff、指定 commit、PR、发布前风险、文档一致性或扩展审核风险；默认只生成审查任务 prompt，不直接 review、不直接修改代码，除非用户明确要求审查并修复。
---

# CodeNote Helper Code Review Prompt 生成

## 技能定位

本 skill 只生成 code review 任务 prompt。它不直接审查当前代码，不默认修复问题，不替代普通开发任务。

默认边界：

- 只要求后续执行者输出 findings first 的审查报告和建议。
- 除非用户明确要求“审查并修复”，否则 prompt 中必须禁止直接修改代码。
- 即使用户要求修复，也要先 findings first，再进入最小修复闭环。

## Skill 交叉引用规则

如果生成的 code review prompt 需要指向其他 skill，必须使用 `$skill-name` 形式引用，例如 `$codenote-fix-prompt` 或 `$codenote-plan-mode-prompt`。不要只写反引号包裹的 skill 名称，也不要把 skill 名称写成普通说明。

## 使用流程

1. 确认用户要的是 code review prompt，而不是直接 review。
2. 明确审查范围：当前 diff、指定 commit、PR diff、发布包、用户指定文件或目录。
3. 读取项目材料：
   - `AGENTS.md`
   - 仅当 `AGENTS.override.md` 存在时读取它。
   - `DEVLOG.md`
   - `README.md`
   - 审查范围相关代码、配置、文档、测试和历史报告。
4. 判断是否需要外部事实支撑：如果审查范围涉及外部平台行为、浏览器 API、OAuth / Google Drive / WebDAV、权限 / 审核政策、第三方 API、最新文档、跨浏览器差异、已知社区问题或反复定位失败的 bug，生成的 review prompt 必须明确要求后续执行者先调用 `$web-search`。
5. 读取 `references/review-template.md`，按本轮范围裁剪。
6. 输出一份完整、连续、可复制的中文 code review prompt。

## 风险地图规则

最终 prompt 不得把固定风险清单当成审查上限。必须要求后续执行者先基于真实 diff、项目规则和审查目标建立本轮风险地图，再从风险地图生成审查重点。

CodeNote Helper 常见风险域可作为启发：

- Chrome MV3 扩展权限、`host_permissions`、`content_scripts.matches`、`optional_host_permissions`。
- 远程请求、用户配置的 API、Google Drive、WebDAV、用户数据是否离开本地。
- 站点隔离、脚本注入顺序、共享模块依赖、全局命名空间。
- README、隐私政策、manifest、商店说明与代码实际行为一致性。
- 用户可见中文文案、错误暴露方式、调试信息是否泄露到 UI。
- Node 测试、浏览器验证、Playwright 证据、报告链接和版本记录是否充分。
- 外部平台行为、浏览器 API、OAuth / Google Drive / WebDAV、第三方 API、跨浏览器差异、审核政策或已知社区问题是否需要 `$web-search` 建立证据链。

这些只是风险维度示例；后续执行者必须根据真实改动补充项目专属风险，不能把示例当完整清单。

## 报告要求

生成的 review prompt 必须要求：

- 审查报告保存为单独 Markdown 文档。
- 报告默认放在项目 `docs/` 下；用户指定路径时使用用户路径。
- 问题位置使用可跳转 Markdown 相对路径链接，优先精确到行号。
- 每条 finding 包含严重级别、位置、证据、影响、可能解决方案、验证建议、是否阻塞发布或交付。
- 问题按严重程度排序。
- 没发现明确问题时，也要生成报告，说明已检查范围、未发现阻塞项、剩余风险和测试缺口。

## 输出包裹规则

- 最终 code review prompt 必须整体放入一个 Markdown 文本块。
- 如果 prompt 内部包含三反引号，外层使用四反引号或更长围栏。
- 输出代码块前最多写一句中文引导；代码块后不要追加正文。

## 自检

输出前检查：

1. 是否明确本 skill 生成的是 review prompt，不是直接 review。
2. 是否要求 findings first、严重程度排序和证据链接。
3. 是否要求先生成本轮风险地图，而不是照抄固定清单。
4. 是否要求审查报告保存为单独 Markdown 文档。
5. 是否保留 CodeNote Helper 的 MV3、权限、远程请求、用户数据、文档一致性、中文文案和测试证据风险域。
6. 涉及外部平台行为、浏览器 API、OAuth、审核政策、第三方 API、跨浏览器差异或反复定位失败 bug 时，是否要求先调用 `$web-search`。
7. 如果 prompt 中交叉引用其他 skill，是否统一使用 `$skill-name` 形式。
8. 是否没有把普通执行或 Plan mode 的完整职责塞进本 prompt。
