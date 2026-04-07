# CLI Project

当前目录用于承载 Codex `agent_identity` MVP 的 CLI 工程。

第一阶段目标：

- 提供本地单进程 CLI 入口
- 加载 `agents/` 下的 `agent_identity.json`
- 写入 `raw-capture` 采集事件
- 通过 `distill` 命令把 `raw-capture` 过滤为 short-term
- 输出运行摘要

如果已经安装了仓库级 `agents` launcher，也可以直接在任意项目目录调用 `agents ...`。通过 launcher 运行时，它会默认把当前仓库作为共享根；可通过 `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT` 临时覆盖。
如果直接执行 `projects/cli/src/cli.ts`，它仍按当前工作目录读写本地 `agents/` 资产。
可用命令也包括 `agents list`，用于枚举共享根里当前存在的 agent identity。

对于外部 workspace 的 Codex session，主路径已经切到 hooks 驱动的 session 内选择协议：

- `SessionStart` 会在未绑定 session 中要求用户选择 identity
- 用户可直接在 Codex session 内回复 `数字`、`agent_id`、`no identity`
- 也支持 `选择 + 任务` 同一条消息
- 选项中明确包含 `No identity (Not applicable Agent Identity / 不适用 Agent Identity)`

`agents mount` 保留为兼容 / 调试入口，不再是推荐主路径：

- 命令会列出当前 workspace 可见的 identities
- 用户必须显式选择一个 identity，或选择 `Do not mount hooks`
- 选择 identity 时，会写入 `<workspace>/.codex/agent-memory/active-agent.json` 并安装 `<workspace>/.codex/hooks.json`
- 选择 `Do not mount hooks` 时，会移除该 workspace 的 binding 与 hooks 注册

示例：

```bash
agents mount
```

本仓库当前默认的开发 / 测试 identity 是 `agentic-memory-expert`。它被标记为 repo-local，只在本仓库 workspace root 下可见。

## 当前可用命令

在仓库根目录执行：

```bash
npm --prefix projects/cli run cli -- init --agent-id demo-agent
npm --prefix projects/cli run cli -- run --agent-id demo-agent --input "summarize current contract research"
npm --prefix projects/cli run cli -- distill --agent-id demo-agent --limit 20
npm --prefix projects/cli run cli -- verify --agent-id demo-agent
```

AI 过滤环境变量（MVP）：

- 默认从 `~/.codex/config.toml` 读取 `model_provider` 与 `model`
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER`（可选，覆盖 config.toml）
- `OPENAI_API_KEY`（`openai` provider 必填）
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`（可选）

运行测试：

```bash
npm --prefix projects/cli test
```
