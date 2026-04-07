# Codex Agent Identity JSON 与 CLI 最小协议

> 2026-04-06 更新注记：当前 MVP 只要求短期记忆采集质量达标；长期记忆写入与长期准入判断暂不启用。

## 目标

定义 Codex `agent_identity` MVP 第一版所需的两个最小契约：

1. `agent_identity.json` 的最小结构
2. 单进程 CLI 的最小命令协议

当前目标是保证 `文件优先单进程` 原型可以被实现、运行和验证，不在这一版扩展额外对象模型。

## 一、`agent_identity.json` 最小结构

### 设计原则

- 只保留当前 `agent_identity` 契约中已经稳定的字段
- 只保留运行期必需字段
- 不加入运行时状态
- 不加入 `skill_pack`
- 不加入 `dynamic_memory`
- 不加入具体后端配置

### 推荐文件路径

```text
agents/<agent_id>/identity/agent_identity.json
```

### 最小 JSON 结构

```json
{
  "agent_id": "research-agent",
  "canonical_name": "Research Agent",
  "specialization": "research",
  "mission": "Produce careful, evidence-backed research artifacts for portable agent systems.",
  "lineage": "origin:research-agent:v1"
}
```

### 字段说明

- `agent_id`
  - 稳定且可迁移的唯一标识
  - 同时作为目录命名和运行时主索引键

- `canonical_name`
  - 人类可读的标准名称
  - 用于运行摘要和审阅输出

- `specialization`
  - 当前 Agent 的专业方向
  - 第一版保持为单字符串

- `mission`
  - 长期稳定职责描述
  - 第一版保持为单字符串，不拆子字段

- `lineage`
  - 来源或演化关系标识
  - 第一版保持为单字符串，不定义结构化 lineage 图

### 第一版校验要求

- 文件必须存在
- 文件必须是有效 JSON
- 以上五个字段必须全部存在
- 五个字段必须都是非空字符串
- `agent_id` 必须与目录名一致

### 当前不进入 JSON 的字段

- 生命周期状态
- 运行时环境信息
- MCP 配置
- 工具权限
- skill 内容
- 记忆状态

原因：

- 这些都不属于当前最小身份本体
- 放进去会让 `agent_identity.json` 提前变成“总配置文件”

## 二、CLI 最小命令协议

### 设计原则

- 采用混合模式
- `run` 是主入口
- `init` 和 `verify` 保持最小化
- 每个命令只做一类主职责
- 第一版以本地 CLI 为唯一入口

## CLI 功能边界

当前 CLI 的定位是：

- 一个本地单进程、短生命周期、文件优先的最小链路执行器

## Codex 当前接入方式

当前 MVP 阶段，Codex 与 CLI 的通信方式不是 MCP，而是本地命令调用。

也就是说：

- Codex 作为调用方
- 通过 shell 执行本地 CLI 命令
- CLI 完成一次身份加载和最小记忆链路
- CLI 将结果输出到控制台并写入本地目录

### 当前调用关系

```text
Codex
  -> shell command
  -> CLI
  -> agent_identity.json
  -> short-term memory files
  -> run summary
```

### 当前为什么不是 MCP

- MVP 目标是先验证最小链路，而不是先验证协议包装层
- 如果一开始就引入 MCP，调试时很难区分问题来自：
  - CLI 核心逻辑
  - 文件落点
  - 还是 MCP 包装层
- 因此当前阶段先保留一个最小本地入口，让 Codex 直接通过命令调用

### 当前 Codex 如何使用 CLI

推荐调用顺序：

1. `init`
2. `run`
3. `verify`

Codex 在当前阶段可以直接执行：

```bash
pnpm tsx src/cli.ts init --agent-id research-agent
pnpm tsx src/cli.ts run --agent-id research-agent --input "summarize current contract research"
pnpm tsx src/cli.ts verify --agent-id research-agent
```

其中：

- `init`
  - 为某个实验性 Agent 初始化目录和身份文件
- `run`
  - 对一次输入执行完整最小链路
- `verify`
  - 检查本地目录和产物是否仍然有效

### 当前 Codex 使用 `agent_identity` 的最小流程

1. Codex 决定使用某个 `agent_id`
2. Codex 调用 `init`，确保本地资产目录存在
3. Codex 调用 `run`
4. CLI 读取 `agents/<agent_id>/identity/agent_identity.json`
5. CLI 用该身份执行一次最小链路
6. CLI 写短期记忆事件
7. CLI 输出短期记忆质量摘要并落盘
8. Codex 如需检查结果，再调用 `verify`

### 未来演化方式

后续如果进入 MCP 服务化，推荐关系应变为：

```text
Codex
  -> MCP tool call
  -> MCP server wrapper
  -> shared core logic
  -> same file-based runtime layout
```

这意味着：

- 当前 CLI 是 Codex 的直接接入方式
- 后续 MCP server 是新的接入方式
- 两者应共享同一套核心逻辑
- CLI 不会被废弃，而会继续作为本地调试和验证入口

当前 CLI 负责的能力只有：

- 初始化实验性 Agent 目录
- 加载 `agent_identity.json`
- 接收一次最小输入
- 写一条短期记忆事件
- 给短期记忆附加最小质量元数据
- 回读最新短期事件
- 输出和保存本次运行摘要
- 校验目录结构和最小文件有效性

当前 CLI 明确不负责：

- 常驻服务
- MCP server
- 多进程或多 worker
- 并发调度
- 复杂检索
- 高质量蒸馏
- `skill_pack` 装载
- 动态记忆完整状态机
- 远程部署
- Obsidian 集成
- 数据库

这意味着第一版 CLI 不是完整 Agent runtime，只是 MVP 的最小闭环执行入口。

### 推荐命令形式

```bash
pnpm tsx src/cli.ts <command> [options]
```

### 总体使用方式

推荐使用顺序：

1. 首次创建 Agent 资产时执行 `init`
2. 进入某次 session 后直接执行 `run`
3. 需要检查产物时执行 `verify`

最小示例：

```bash
pnpm tsx src/cli.ts init --agent-id research-agent
pnpm tsx src/cli.ts run --agent-id research-agent --input "summarize current contract research"
pnpm tsx src/cli.ts verify --agent-id research-agent
```

命令关系：

- `init`
  - 负责 session 外的首次资产初始化
- `run`
  - 负责某次 session 内的一次完整执行链路
- `verify`
  - 负责检查目录、文件和最小回读结果

### `init` 与 session 的关系

`init` 不属于每个 session 的固定前置步骤。

当前框架中应明确：

- `init` 是 Agent 资产初始化动作
- 它服务于跨 session 持续存在的 Agent
- 同一个 Agent 初始化完成后，后续多个 session 应直接复用既有目录、身份文件和记忆目录
- `run` 才是 session 内的主入口

因此：

- 不应要求每次 session 开始前都先执行 `init`
- `run` 在正常情况下应假定目标 Agent 已存在
- 若 Agent 不存在，`run` 应报错并提示先执行一次 `init`

### 命令 1：`init`

作用：

- 初始化一个实验性 Agent 的本地目录骨架
- 写入最小 `agent_identity.json`
- 创建 `raw-capture`、`short-term` 与运行摘要目录

建议调用：

```bash
pnpm tsx src/cli.ts init --agent-id research-agent
```

最小参数：

- `--agent-id`

最小输出：

- 输出创建的目录路径
- 输出 `agent_identity.json` 路径

使用说明：

- 只在第一次为某个 Agent 建立本地资产目录时使用
- 不应把它当成每个 session 的常规步骤
- 若尚未初始化，不应直接依赖 `run` 替代 `init`
- 第一版默认不覆盖已有目录

失败条件：

- 目标目录已存在且非空时，默认失败

### 命令 2：`run`

作用：

- 加载 `agent_identity.json`
- 接收一次最小输入
- 写入一条 `raw_capture` 采集事件
- 输出运行摘要

建议调用：

```bash
pnpm tsx src/cli.ts run --agent-id research-agent --input "summarize current contract research"
```

最小参数：

- `--agent-id`
- `--input`

最小行为：

1. 校验目标 Agent 目录存在
2. 读取 `agent_identity.json`
3. 生成 raw-capture 事件
4. 写入 `memory/raw-capture/`
5. 不生成 short-term（仅采集）
8. 写入本次运行摘要到 `runs/`
9. 输出控制台摘要

最小输出：

- `agent_id`
- 本次生成的 raw-capture 事件路径

使用说明：

- 这是第一版 CLI 的主命令
- 它对应 session 内的一次原始采集
- 每次调用只处理一次输入
- 每次调用都应生成新的 raw-capture 事件和新的运行摘要
- 如果身份文件不存在，应报错并提示先执行 `init`

失败条件：

- `agent_identity.json` 缺失
- JSON 非法
- 字段缺失
- 写文件失败

### 命令 3：`verify`

作用：

- 校验 Agent 目录结构是否完整
- 校验 `agent_identity.json` 是否有效
- 校验 `raw-capture`、`short-term`、运行摘要目录是否存在
- 可选读取最新 short-term 做最小回读验证

建议调用：

```bash
pnpm tsx src/cli.ts verify --agent-id research-agent
```

最小参数：

- `--agent-id`

最小输出：

- 目录检查结果
- 身份文件检查结果
- 最新 short-term 回读结果

使用说明：

- 在初始化后可执行一次，确认目录骨架正确
- 在每次 `run` 后可执行一次，确认本次链路产物没有破坏结构
- 这是 MVP 的最小可靠性验证入口，不负责深度业务验证

失败条件：

- 目录缺失
- 身份文件缺失或非法

## 三、命令职责边界

### `init` 负责

- session 外首次初始化
- 目录创建
- 身份文件生成

### `run` 负责

- session 内一次原始采集执行
- raw-capture 写入
- 摘要输出

### `verify` 负责

- 结构校验
- 文件有效性校验
- 最小回读验证

### 命令不应互相替代的边界

- `init` 不负责写入短期或长期记忆
- `run` 不负责 short-term 过滤生成
- `run` 不负责首次身份资产生成
- `verify` 不负责修复目录或补写文件
- `init` 不应被设计成“每个 session 先做一次”的步骤

## 四、推荐目录结构

```text
agents/
  <agent_id>/
    identity/
      agent_identity.json
    memory/
      raw-capture/
      short-term/
    runs/
```

## 五、`projects/reve` Distill 契约

从 2026-04-07 起，`distill` 从 CLI 工程拆分到独立工程 `projects/reve`，并通过 `bin/reve` 暴露入口。

作用：

- 从 `raw-capture` 读取待处理记录
- 使用推理模型做过滤与收敛
- 仅把通过过滤的记录写入 `short-term`
- 输出本轮 distill 摘要

建议调用：

```bash
bin/reve distill --agent-id research-agent --limit 20
```

最小参数：

- `--agent-id`
- `--limit`（可选，默认 20）

最小输出：

- 本轮扫描条数
- 本轮写入 short-term 条数
- 本轮跳过条数

AI 环境要求（MVP）：

- 默认从 `~/.codex/config.toml` 读取 `model_provider` 与 `model`
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER` 可覆盖 config.toml
- 当 provider 要求 OpenAI 鉴权时需设置 `OPENAI_API_KEY`
- 可选模型变量：`OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`

## 六、与后续 MCP 演化的兼容性

这套契约的设计目标是：

- 当前可被 CLI 直接使用
- 后续可以把 `run` 背后的核心逻辑提取为服务层
- 再进一步挂到 MCP 入口，而不需要改 `agent_identity.json` 的最小结构

因此：

- `agent_identity.json` 保持纯身份本体
- CLI 保持输入输出清晰
- 目录结构保持稳定

## 七、当前建议冻结项

建议现在冻结：

- `agent_identity.json` 使用 JSON
- 五个最小身份字段
- CLI 采用 `init / run / verify`
- `run` 作为主入口
- `projects/reve distill` 作为 short-term 生成入口

## 八、当前暂不冻结项

- 是否增加 `--root` 参数支持自定义根目录
- 是否增加 `--force` 覆盖初始化
- `verify` 是否细分为更严格的模式

## 下一步

基于这份契约，下一步应进入实现前最后确认：

1. CLI 参数命名是否保持当前形式
2. 是否允许 `run` 在目录缺失时自动提示先执行 `init`
