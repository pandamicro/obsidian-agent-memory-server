# CLI Project

当前目录用于承载 Codex `agent_identity` MVP 的 CLI 工程。

第一阶段目标：

- 提供本地单进程 CLI 入口
- 加载 `agents/` 下的 `agent_identity.json`
- 写入短期记忆事件
- 生成长期记忆占位对象
- 输出运行摘要

如果已经安装了仓库级 `agents` launcher，也可以直接在任意项目目录调用 `agents ...`。通过 launcher 运行时，它会默认把当前仓库作为共享根；可通过 `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT` 临时覆盖。
如果直接执行 `projects/cli/src/cli.ts`，它仍按当前工作目录读写本地 `agents/` 资产。
可用命令也包括 `agents list`，用于枚举共享根里当前存在的 agent identity。

本仓库当前默认的开发 / 测试 identity 是 `agentic-memory-expert`。它被标记为 repo-local，只在本仓库 workspace root 下可见。

## 当前可用命令

在仓库根目录执行：

```bash
npm --prefix projects/cli run cli -- init --agent-id demo-agent
npm --prefix projects/cli run cli -- run --agent-id demo-agent --input "summarize current contract research"
npm --prefix projects/cli run cli -- verify --agent-id demo-agent
```

运行测试：

```bash
npm --prefix projects/cli test
```
