# Agents Directory

当前目录是默认的 Agent 资产与记忆存储根目录。

约定：

- 每个 Agent 使用一个独立子目录
- 身份文件放在 `identity/agent_identity.json`
- 如需限制可见性，可在 `identity/agent_scope.json` 声明 repo-local 范围
- 短期记忆放在 `memory/short-term/`
- 长期记忆放在 `memory/long-term/`
- 运行摘要放在 `runs/`

运行期清理：

- 运行期生成的未跟踪记忆文件可先用 `scripts/cleanup-runtime-artifacts.sh` 做 dry-run
- 确认后再用 `scripts/cleanup-runtime-artifacts.sh --apply` 清理未跟踪运行产物
- 该脚本只处理 `agents/*/memory/{short-term,long-term}` 与 `agents/*/runs` 下的未跟踪文件，不会删除已跟踪的 seed 数据

当前仓库默认开发 / 测试 identity 是 `agentic-memory-expert`，它只在本仓库 workspace root 下可见。

运行期若产生了未跟踪的短期记忆、长期记忆或 run 摘要噪音，可先 dry-run：

```bash
scripts/cleanup-runtime-artifacts.sh
```

确认后再执行：

```bash
scripts/cleanup-runtime-artifacts.sh --apply
```
