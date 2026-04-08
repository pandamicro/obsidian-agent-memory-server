# Reve Project

`projects/reve` 负责模型相关的记忆收敛逻辑。

MVP 当前提供：

- `distill`: 从 `raw-capture` 读取候选，过滤后写入 `short-term`
- `consolidate`: 从 `short-term` episode 批次形成 `Learning`，写入 `long-term`
- `drive`: 串行执行 `distill` + `consolidate`，并写入一条聚合 run summary

调用入口：

```bash
bin/reve distill --agent-id research-agent --limit 20
bin/reve consolidate --agent-id research-agent --limit 20 --batch-size 10
bin/reve drive --agent-id research-agent --limit 20 --batch-size 10
```

推荐手工评估流程：

1. 先检查 `Episode`（`short-term`）内容质量与可追溯性
2. 再检查 `Learning`（`long-term`）是否正确归纳 episode 批次
3. 回归测试场景优先用 `drive` 一次跑完整链路

人工评估时优先看这几类信号：

- `Episode` 是否保持单一、具体、可验证，不要把多个候选信号合并成一条抽象总结
- `evidence_refs` 是否能直接回链到原始输入或明确 turn，而不是只有间接提示
- 如果 `consolidate` 成功但结果是 `needs_more_evidence`，优先判断 short-term 是否仍然偏规范性表述、观察性不足，而不是直接怀疑长期蒸馏链路

`bin/reve` 会在启动时自动加载仓库根目录的 `.env.agent-memory`。
如需自定义路径，可设置 `OBSIDIAN_AGENT_MEMORY_SERVER_ENV_FILE`。

AI 过滤环境变量（MVP）：

`distill` 读取：

- 默认从 `~/.codex/config.toml` 的 `model_provider` 与 `model` 节。
- 环境变量 `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER` 可覆盖 `model_provider`，`OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL` 可覆盖 `model`。
- 如果所选 provider 需要 OpenAI 鉴权，必须提供 `OPENAI_API_KEY`。

`consolidate` 读取：

- 默认从 `~/.codex/config.toml` 的 `consolidate_model_provider` 与 `consolidate_model` 节。
- 环境变量 `OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER` 可覆盖 `consolidate_model_provider`，`OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL` 可覆盖 `consolidate_model`。
- `OPENAI_API_KEY` 同样会在需要 OpenAI 鉴权时被读取（与 distill 共用）。
- 对 `codex` 类 `responses` 网关，当前 consolidate schema 已验证需要顶层 `status` / `reason` / `learning` 全必填；其中 `learning` 在 `no_learning` 或 `needs_more_evidence` 时返回 `null`。

## Long-Term Output

MVP2 当前唯一的长期产物是 `Learning`。每条 `Learning` 记录包含以下字段：

- `message_id`
- `identity_id`
- `object_kind`
- `object_ref`
- `source_episode_ids`
- `summary`
- `applicability`
- `failure_conditions`
- `evidence_refs`
- `confidence`
- `quality`
- `observed_at`
- `consolidation_run_id`

`Learning` 是对多个 episode 的稳定经验提炼，后续版本可再新增 `Behavior Delta` 等其他长期对象，这里先锁定为 MVP2 first-pass long-term 输出。
