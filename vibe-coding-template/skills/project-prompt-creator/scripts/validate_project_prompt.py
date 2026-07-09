#!/usr/bin/env python3
"""Validate key constraints in a project task prompt template or generated prompt."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


EXACT_MARKDOWN_BLOCK_RULE = (
    "- 最终 prompt 必须整体放入一个 Markdown 文本块。\n"
    "- 如果 prompt 内部包含三反引号，外层使用四反引号或更长围栏。\n"
    "- 输出代码块前最多写一句中文引导；输出代码块后不要追加额外正文。"
)


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
    missing: list[str] = []
    if EXACT_MARKDOWN_BLOCK_RULE not in text:
        missing.append("缺少逐字一致的 Markdown 文本块强制规则。")

    rules = [
        Rule("缺少任务开场和仓库路径。", needles=("当前仓库", "{{仓库路径}}")),
        Rule("缺少硬性前置要求。", needles=("【硬性前置要求（必须先做）】", "不做任何修改前")),
        Rule("缺少必读文件要求。", needles=("必须先阅读", "{{项目规则文件}}", "{{README路径}}")),
        Rule("缺少简体中文和保留专有名词规则。", needles=("简体中文", "代码", "命令", "文件路径")),
        Rule("缺少真实入口 / 调用链 / 验证方式要求。", needles=("真实入口", "调用链", "验证方式")),
        Rule("缺少不回滚用户已有改动规则。", needles=("不要回滚用户已有改动", "dirty")),
        Rule("缺少未验证 / 推测边界。", needles=("未验证", "推测")),
        Rule("缺少项目定位与边界。", needles=("【项目定位与边界】", "{{项目类型}}", "{{本轮任务范围}}")),
        Rule("缺少参考材料不可机械复制私有内容规则。", needles=("参考材料", "不要机械复制私有路径")),
        Rule("缺少版本与文档策略。", needles=("【版本与文档策略（必须遵守）】", "{{当前版本}}", "{{版本文件}}", "{{报告目录}}")),
        Rule("缺少不触发版本或报告时的说明要求。", needles=("不触发版本号或报告", "明确说明原因")),
        Rule("缺少报告相对路径交叉引用规则。", needles=("Markdown 相对路径", "具体文件名")),
        Rule("缺少 TODO 分块结构。", needles=("【本次要完成的 TODO，必须全部落地】", "A.", "B.")),
        Rule("缺少实现约束。", needles=("【实现约束】", "最小必要改动", "盲目保守")),
        Rule("缺少真实仓库结构 / 调用链 / 测试入口要求。", needles=("真实仓库结构", "真实调用链", "真实测试入口")),
        Rule("缺少禁止空壳和不可验证约束。", needles=("堆空壳", "不可验证约束")),
        Rule("缺少无依据保护逻辑的通用判定规则。", needles=("保护逻辑", "依据", "误伤风险", "验证方式", "后续调整方式")),
        Rule("缺少保护逻辑依据、影响和验证要求。", needles=("依据", "误伤风险", "验证方式", "后续调整方式")),
        Rule("缺少错误处理禁止吞异常 / 伪造成功规则。", needles=("broad try/catch", "吞异常", "伪造成功")),
        Rule("缺少测试与验证要求。", needles=("【测试与验证要求，必须执行】", "{{验证命令 1}}", "UTF-8")),
        Rule("缺少不可假装运行不适用测试规则。", needles=("不要假装运行", "只列实际适用")),
        Rule("缺少验证失败说明规则。", needles=("失败命令", "替代验证", "仍未验证的边界")),
        Rule("缺少交付物要求。", needles=("【交付物要求】", "文件改动清单", "问题与修复闭环", "版本同步清单", "最终结论")),
        Rule("缺少证据路径和修复报告路径要求。", needles=("证据路径", "修复报告路径")),
        Rule("缺少注意事项。", needles=("【注意】", "不要把历史测试结果写成本轮验证结果")),
        Rule("缺少 Markdown 文本块包裹提醒。", needles=("Markdown 文本块", "四反引号", "输出代码块前最多写一句中文引导")),
    ]
    missing.extend(rule.message for rule in rules if not rule.matches(text))
    return missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="检查项目任务 prompt 模板或生成物是否保留关键执行约束。"
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
        print("失败：项目任务 prompt 缺少以下关键约束：")
        for item in missing:
            print(f"- {item}")
        return 1

    print("通过：项目任务 prompt 关键约束检查通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
