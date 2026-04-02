# CLI Project

当前目录用于承载 Codex `agent_identity` MVP 的 CLI 工程。

第一阶段目标：

- 提供本地单进程 CLI 入口
- 加载 `agents/` 下的 `agent_identity.json`
- 写入短期记忆事件
- 生成长期记忆占位对象
- 输出运行摘要

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
