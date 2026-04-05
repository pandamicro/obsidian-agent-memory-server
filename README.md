# obsidian-agent-memory-server

一个面向可移植 Agent 的专属技能与专属记忆研究仓库。

## 项目目标

- 定义可跨项目、跨环境即插即用的 Agent 本体
- 让 Agent 通过专属记忆持续积累可复用的专业经验
- 让同一个 Agent 可通过适配层接入不同运行环境，而不依赖特定后端

## 当前范围（v0）

- 定义 Portable Agent Contract 的最小模型
- 定义 `agent_identity`、`skill_pack`、`dynamic_memory`、`adapter_contract` 的边界
- 定义 dynamic memory 中高价值经验的抽象与分层
- 明确 Obsidian 在系统中的合理职责

## 文档

- 架构占位文档：`docs/architecture.md`
- 研究记忆文档：`docs/research-memory.md`
- Portable Agent Contract：`docs/portable-agent-contract.md`（主入口）
- 子文档目录：`docs/portable-agent-contract/`
- Agent 研究约束：`AGENTS.md`

## 本机入口

仓库提供一个可放入 `PATH` 的 `agents` launcher，它会把命令转发到当前仓库的 `projects/cli`，并默认把当前仓库作为这台机器上的共享 `agent_identity` 与共享记忆根。

默认安装后可以在任意项目里直接调用：

```bash
agents list
agents init --agent-id research-agent
agents run --agent-id research-agent --input "summarize current contract research"
agents verify --agent-id research-agent
```

如果需要临时切换共享根，可以设置 `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT`。

如果需要清理运行期产生的未跟踪记忆产物，可先 dry-run：

```bash
scripts/cleanup-runtime-artifacts.sh
```

确认后再执行 `scripts/cleanup-runtime-artifacts.sh --apply`。

## 里程碑（草案）

- M0：项目初始化与文档基线
- M1：最小记忆读写能力
- M2：角色化记忆与跨项目策略
- M3：多工作流适配验证
