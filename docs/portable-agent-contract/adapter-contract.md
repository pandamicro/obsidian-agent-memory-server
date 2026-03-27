# adapter_contract

## 作用

定义同一个 Agent 需要什么样的运行时适配能力，才能接入 Claude Code、Codex、MCP、Obsidian 或其他运行环境。

这里强调的是 `Contract`，不是具体适配器实现。

- `adapter_contract` 属于 Agent 本体模型的一部分
- 具体的 adapter implementation 属于外部环境，可以被多个 Agent 共享

换句话说：

- Agent 需要声明“我要求什么能力表面”
- 环境负责提供“哪个适配器实例来满足这些能力”

## 最小组成

- `adapter_kind`
- `required_capabilities`
- `capability_map`
- `context_injection_policy`
- `persistence_policy`
- `failure_fallbacks`

## 边界

`adapter_contract` 描述桥接要求，但不等于桥接实现本身。它不能重新定义 Agent 身份、技能或记忆本体。

## 禁止混入

- Agent 专属经验本体
- 长期角色定义
- 工作区专属脏状态被错误持久化回 Agent
- 某个具体部署环境的本地路径或硬编码实例信息
