# Reve Project

`projects/reve` 负责模型相关的记忆收敛逻辑。

MVP 当前提供：

- `distill`: 从 `raw-capture` 读取候选，过滤后写入 `short-term`

调用入口：

```bash
bin/reve distill --agent-id research-agent --limit 20
```

`bin/reve` 会在启动时自动加载仓库根目录的 `.env.agent-memory`。
如需自定义路径，可设置 `OBSIDIAN_AGENT_MEMORY_SERVER_ENV_FILE`。

AI 过滤环境变量（MVP）：

- 默认从 `~/.codex/config.toml` 读取 `model_provider` 与 `model`
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER`（可选，覆盖 config.toml）
- `OPENAI_API_KEY`（当 provider 需要 OpenAI 鉴权时必填）
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`（可选）
