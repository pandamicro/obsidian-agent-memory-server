# Agents Directory

当前目录是默认的 Agent 资产与记忆存储根目录。

约定：

- 每个 Agent 使用一个独立子目录
- 身份文件放在 `identity/agent_identity.json`
- 如需限制可见性，可在 `identity/agent_scope.json` 声明 repo-local 范围
- 短期记忆放在 `memory/short-term/`
- 长期记忆放在 `memory/long-term/`
- 运行摘要放在 `runs/`

当前仓库默认开发 / 测试 identity 是 `agentic-memory-expert`，它只在本仓库 workspace root 下可见。
