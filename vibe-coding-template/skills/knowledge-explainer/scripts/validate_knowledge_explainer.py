#!/usr/bin/env python3
"""Validate key constraints in a knowledge-explainer SKILL.md."""

from __future__ import annotations

import argparse
import re
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


def validate_frontmatter(text: str) -> list[str]:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return ["frontmatter 缺失：文件必须以 --- 开头，并包含 name 和 description。"]

    match = re.match(r"^---\r?\n(?P<body>.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return ["frontmatter 未闭合：必须使用第二个 --- 结束 frontmatter。"]

    body = match.group("body")
    missing: list[str] = []
    if not re.search(r"(?m)^name\s*:", body):
        missing.append("frontmatter 缺少 name 字段。")
    if not re.search(r"(?m)^description\s*:", body):
        missing.append("frontmatter 缺少 description 字段。")
    return missing


def validate_rules(text: str) -> list[str]:
    rules = [
        Rule("缺少最高约束小节：必须保留 `## 最高约束`。", needles=("## 最高约束",)),
        Rule("缺少 1000 字硬门槛：口述版必须明确不少于 1000 字。", needles=("1000",), any_of=("不少于 1000 字", ">=1000字", ">= 1000 字")),
        Rule("缺少 3000 字硬门槛：详细讲解版必须明确不少于 3000 字。", needles=("3000",), any_of=("不少于 3000 字", ">=3000字", ">= 3000 字")),
        Rule("缺少输出失败规则：未达字数门槛必须视为输出失败并继续补写。", needles=("输出失败",)),
        Rule("缺少禁止提纲化压缩规则。", any_of=("禁止以提纲化压缩", "提纲化压缩")),
        Rule("缺少从基础概念递进讲解要求。", needles=("从最基础概念开始",)),
        Rule("缺少口述版输出结构。", needles=("可直接口述回答",)),
        Rule("缺少详细原理讲解输出结构。", needles=("详细原理讲解",)),
        Rule("缺少项目落地点输出结构。", needles=("项目落地点",)),
        Rule("缺少面试官 / 评审者追问输出结构。", needles=("面试官", "追问")),
        Rule("缺少质量门槛小节：必须保留 `## 质量门槛`。", needles=("## 质量门槛",)),
        Rule("缺少自检小节：必须保留 `## 自检`。", needles=("## 自检",)),
        Rule("缺少公式、符号和直观意义解释要求。", needles=("公式解释", "符号解释", "直观意义")),
        Rule("缺少案例、比喻和记忆抓手要求。", needles=("案例", "比喻", "记忆")),
        Rule("缺少未实现能力边界：必须区分已实现、正在设计、后续可扩展和需要验证。", needles=("已实现", "正在设计", "后续可扩展", "需要验证")),
        Rule("缺少外部依据联动：涉及最新事实时必须调用 `$web-search`。", needles=("$web-search",)),
    ]
    return [rule.message for rule in rules if not rule.matches(text)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="检查 knowledge-explainer SKILL.md 是否保留关键质量约束。"
    )
    parser.add_argument("skill_path", help="目标 knowledge-explainer/SKILL.md 路径")
    args = parser.parse_args(argv)

    path = Path(args.skill_path)
    try:
        text = read_utf8(path)
    except ValueError as exc:
        print(f"失败：{exc}")
        return 1

    missing = validate_frontmatter(text)
    missing.extend(validate_rules(text))

    if missing:
        print("失败：knowledge-explainer 缺少以下关键质量约束：")
        for item in missing:
            print(f"- {item}")
        return 1

    print("通过：knowledge-explainer 关键质量约束检查通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
