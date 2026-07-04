#!/usr/bin/env python3
"""Validate key constraints in an AGENTS.md template or generated AGENTS.md."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Rule:
    message: str
    needles: tuple[str, ...] = ()
    any_of: tuple[str, ...] = ()

    def matches(self, text: str) -> bool:
        if self.needles and not all(needle in text for needle in self.needles):
            return False
        if self.any_of and not any(needle in text for needle in self.any_of):
            return False
        return True


def read_utf8(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"UTF-8 读取失败：{exc}") from exc
    except OSError as exc:
        raise ValueError(f"文件读取失败：{exc}") from exc


def validate_rules(text: str) -> list[str]:
    exact_report_link_rule = (
        "生成报告时必须使用可跳转的 Markdown 相对路径交叉引用。"
        "链接优先落到具体文件名，能定位到行号时必须使用 `[文件名](相对路径#L行号)` 范式；"
        "不要把 `:行号` 写进链接目标里。"
        "不要只写文件夹名代替关键证据，也不要使用当前 IDE 无法跳转的绝对路径，必须强制使用相对路径。"
    )
    progress_block_needles = (
        "在执行命令、读写文件、测试页面、查看日志时，使用简洁中文进度块：",
        "> 🧩 步骤：{一句话描述正在做什么}",
        "> 🎯 目的：{为什么要做}",
        "> ▶️ 执行：{命令、页面、文件路径或操作}",
        "> ✅ 结果：{当前状态}",
        "> 🧾 证据：{可验证证据路径}",
        "> 📝 备注：{可选，最多一句}",
    )
    report_content_needles = (
        "报告至少覆盖：",
        "1. 本轮问题 / 目标与范围。",
        "2. 改动文件清单。",
        "3. 关键修复内容。",
        "4. 验收方式 / 手测步骤 / 自动化测试情况。",
        "5. 版本同步清单。",
        "6. 风险与备注。",
        "7. 结论。",
    )
    naming_rule_needles = (
        "新增文件、目录、测试和报告命名要体现职责与场景，避免只有时间戳、缩写或模糊命名。",
    )
    rules = [
        Rule("缺少执行环境前置规则。", needles=("执行环境前置规则", "操作系统", "shell")),
        Rule("缺少跨平台命令语法提醒。", needles=("Windows PowerShell", "Linux Bash", "macOS")),
        Rule("缺少 UTF-8 / 编码要求。", any_of=("UTF-8", "utf-8")),
        Rule("缺少顶层代码生成约束。", needles=("顶层代码生成约束", "最小必要改动")),
        Rule("缺少允许有依据的大范围重构边界。", needles=("盲目保守", "根因", "影响范围", "可回滚")),
        Rule("缺少真实仓库结构 / 调用链 / 测试入口依据要求。", needles=("真实仓库结构", "真实调用链", "真实测试入口")),
        Rule("缺少禁止空壳和不可验证约束。", needles=("堆空壳", "不可验证约束")),
        Rule("缺少超长单文件代码约束。", needles=("超长单文件", "职责边界")),
        Rule("缺少新增文件 / 目录 / 测试 / 报告命名规则。", needles=naming_rule_needles),
        Rule("缺少修改前必读规则。", needles=("修改前必读", "README")),
        Rule("缺少修复报告规则。", needles=("修复报告规则", "报告目录")),
        Rule("缺少报告触发 / 不触发边界。", needles=("纯文档", "默认不触发修复报告", "用户明确要求")),
        Rule("缺少报告命名占位符规则。", needles=("{{报告目录}}", "{{版本号}}", "{{日期}}")),
        Rule("缺少完整修复报告内容清单。", needles=report_content_needles),
        Rule("缺少报告 Markdown 相对路径交叉引用原文规则。", needles=(exact_report_link_rule,)),
        Rule("缺少版本号演进规则。", needles=("版本号演进规则", "{{当前版本}}", "{{版本文件}}", "{{README版本位置}}")),
        Rule("缺少 PATCH / MINOR / MAJOR 说明。", needles=("PATCH", "MINOR", "MAJOR")),
        Rule("缺少默认不升版边界。", needles=("用户没有明确要求 bump", "默认在当前版本继续修改")),
        Rule("缺少保护逻辑与错误处理原则。", needles=("保护逻辑", "错误处理")),
        Rule("缺少无依据保护逻辑的通用判定规则。", needles=("没有依据", "依据", "误伤", "验证", "后续")),
        Rule("缺少吞异常 / 伪造成功禁止项。", needles=("吞异常", "伪造成功")),
        Rule("缺少测试与验证规则。", needles=("测试与验证", "未验证")),
        Rule("缺少输出与验收格式。", needles=("输出与验收格式", "文件改动清单", "版本同步清单", "最终结论")),
        Rule("缺少 docs 修复报告路径要求。", needles=("修复报告路径",)),
        Rule("缺少进度播报格式。", needles=("进度播报格式", "步骤", "目的", "执行", "结果", "证据", "备注")),
        Rule("缺少完整进度播报触发场景与 6 行格式。", needles=progress_block_needles),
        Rule("缺少不回滚用户改动规则。", needles=("不要回滚用户已有改动",)),
        Rule("缺少项目专项约束条件启用规则。", needles=("项目专项", "适用条件")),
    ]
    return [rule.message for rule in rules if not rule.matches(text)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="检查 AGENTS.md 模板或生成物是否保留关键项目级约束。"
    )
    parser.add_argument("agents_path", help="目标 AGENTS.md 或 agents-template.md 路径")
    args = parser.parse_args(argv)

    try:
        text = read_utf8(Path(args.agents_path))
    except ValueError as exc:
        print(f"失败：{exc}")
        return 1

    missing = validate_rules(text)
    if missing:
        print("失败：AGENTS 模板 / 文件缺少以下关键约束：")
        for item in missing:
            print(f"- {item}")
        return 1

    print("通过：AGENTS 关键约束检查通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
