#!/usr/bin/env python3
"""Validate key constraints in a CodeNote Helper execution prompt."""

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
    rules = [
        Rule("缺少普通执行模式开场。", needles=("当前仓库", "普通执行模式")),
        Rule("缺少硬性前置要求。", needles=("【硬性前置要求（必须先做）】", "修改前必须先阅读")),
        Rule("缺少 AGENTS.override.md 存在时才读取的边界。", needles=("AGENTS.override.md", "存在", "不要写成必读事实")),
        Rule("缺少 DEVLOG.md / README.md 必读要求。", needles=("DEVLOG.md", "README.md")),
        Rule("缺少简体中文与专有名词保留规则。", needles=("简体中文", "代码", "命令", "路径")),
        Rule("缺少真实入口 / 调用链 / 验证方式要求。", needles=("真实入口", "调用链", "验证方式")),
        Rule("缺少不回滚用户已有改动规则。", needles=("不要回滚用户已有改动", "dirty")),
        Rule("缺少未验证 / 推测边界。", needles=("未验证", "推测")),
        Rule("缺少 Windows 与 UTF-8 编码要求。", needles=("Windows", "UTF-8")),
        Rule("缺少 CodeNote Helper 项目定位。", needles=("CodeNote Helper", "Chrome MV3", "浏览器扩展")),
        Rule("缺少根目录 references 非项目代码边界。", needles=("references/", "仅供参考", "非项目代码")),
        Rule("缺少版本现场核对要求。", needles=("manifest.json", "popup/popup.html", "README.md", "当前版本")),
        Rule("缺少 DEVLOG / docs 修复报告策略。", needles=("DEVLOG.md", "docs/fix-report", "Markdown 相对路径")),
        Rule("缺少事项分块。", needles=("【本次要完成的事项，必须全部落地】", "A.")),
        Rule("缺少实现约束。", needles=("【实现约束】", "最小必要改动")),
        Rule("缺少站点隔离 / 注入顺序 / 共享数据结构边界。", needles=("站点隔离", "脚本注入顺序", "共享数据结构")),
        Rule("缺少权限与远程代码审核边界。", needles=("host_permissions", "content_scripts.matches", "远程托管代码")),
        Rule("缺少无依据保护逻辑通用边界。", needles=("保护逻辑", "依据")),
        Rule("缺少用户可见文案自然中文要求。", needles=("用户可见文案", "自然中文")),
        Rule("缺少测试与验证要求。", needles=("【测试与验证要求，必须执行】", "Node", "Playwright")),
        Rule("缺少文档 / prompt / skill 修改时的结构与编码验证规则。", needles=("只修改文档", "结构", "编码", "frontmatter")),
        Rule("缺少验证失败说明规则。", needles=("失败命令", "失败原因", "替代验证", "剩余风险")),
        Rule("缺少交付物顺序。", needles=("【交付物要求】", "文件改动清单", "版本同步清单", "最终结论")),
        Rule("缺少 docs 修复报告路径说明。", needles=("docs 修复报告路径",)),
        Rule("缺少注意事项。", needles=("【注意】", "历史测试结果", "人工完成")),
    ]
    return [rule.message for rule in rules if not rule.matches(text)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="检查 CodeNote Helper 普通执行 prompt 是否保留关键质量约束。"
    )
    parser.add_argument("prompt_path", help="目标 prompt-template.md 或生成出的 prompt 文件路径")
    args = parser.parse_args(argv)

    try:
        text = read_utf8(Path(args.prompt_path))
    except ValueError as exc:
        print(f"失败：{exc}")
        return 1

    missing = validate_rules(text)
    if missing:
        print("失败：CodeNote Helper 普通执行 prompt 缺少以下关键约束：")
        for item in missing:
            print(f"- {item}")
        return 1

    print("通过：CodeNote Helper 普通执行 prompt 关键约束检查通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
