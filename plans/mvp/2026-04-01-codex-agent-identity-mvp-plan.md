# Codex Agent Identity MVP Plan

> 2026-04-06 更新注记：MVP 当前阶段临时冻结长期记忆写入与长期准入判断，聚焦短期记忆采集质量。

**Goal:** 定义并实现一个面向 Codex 环境的实验性 `agent_identity` 可运行原型，用单进程、文件优先的极简方式串起身份加载、短期记忆写入与最小验证闭环。

**Architecture:** MVP 采用 `文件优先单进程`。一个本地进程负责加载 `agent_identity` 资产文件，接收最小输入，写入短期记忆事件并附带质量元数据；所有状态以本地文件保存，优先保证链路清晰、目录边界明确、验证路径稳定。

当前 Codex 接入方式：

- 通过 shell 直接调用本地 CLI
- 当前不是 MCP 接入
- 后续如需 MCP 化，应在同一代码基上为 CLI 核心逻辑增加 MCP 包装层

**Scope Constraints:**

- 只做 Codex 环境下的实验性原型
- 只做单进程
- 只做文件优先部署
- 允许大量逻辑为 stub 或极弱实现
- 先串通流程，不追求主体功能完整
- 不引入复杂检索
- 不引入后台多进程蒸馏
- 不引入 MCP 服务化
- 不引入完整 `skill_pack`

## MVP Success Criteria

满足以下条件即可视为 MVP 成立：

1. 存在一个最小 `agent_identity` 文件，能被原型进程加载
2. 原型进程能接收一次最小输入并生成一条短期记忆事件
3. 原型进程能把短期记忆写入专用目录
4. 原型进程能对短期事件给出最小质量判定
5. 存在可重复运行的验证命令，证明整条链路可用

## MVP Non-Goals

- 不实现完整身份治理
- 不实现身份自动比对算法
- 不实现真实高质量蒸馏
- 当前阶段不写入长期记忆对象
- 不实现复杂长期检索排序
- 不实现多 Agent 协作
- 不实现跨环境同步
- 不实现 Obsidian 深度集成

## AI Environment Setup（MVP）

为保证 short-term 经过推理模型过滤，MVP 采用可切换 provider：

- 默认从 `~/.codex/config.toml` 读取：`model_provider`、`model`
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER` 作为显式覆盖
- `mock`：本地可测路径（默认开发回归）
- 配置中的 provider（如 `openai`/`codex`）走对应 `model_providers.<id>.base_url` 与 `wire_api`
- `OPENAI_API_KEY`：当 provider 要求 OpenAI 鉴权时必填
- `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`：可选，默认使用仓库约定模型名

运行建议：

1. 开发与 CI 默认使用 `mock`，保证稳定回归
2. 集成验证使用 `openai`，验证真实过滤质量
3. 无 API Key 或模型失败时保持 fail-open，不阻断 raw capture 写入

## CLI Boundary Reference

CLI 的详细功能边界、命令职责和使用说明，统一以：

- `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md`

为准。

## Distill Boundary Update (2026-04-07)

为保持 `projects/cli` 的职责纯净，MVP 决策更新如下：

- `projects/cli` 仅保留身份与采集链路（`init/run/verify/list/mount`）
- `distill` 与后续长期记忆总结逻辑迁移到独立工程 `projects/reve`
- 新增独立入口 `bin/reve`，用于：
  - 外部周期任务调用
  - hooks 的可选 stop 阶段主动触发（fail-open）

这意味着：

- short-term 生成仍是 `raw-capture -> distill -> short-term`
- 但 `distill` 不再属于 CLI 工程内部实现

## Minimal Runtime Shape

推荐第一版运行形态：

- 一个 CLI 驱动的短生命周期本地进程
- 启动时加载已存在的 `agent_identity`
- 处理单次输入
- 写入 `raw_capture` 事件文件
- 通过 `distill` 过滤并写入 short-term
- 输出本次运行摘要

补充约束：

- `init` 属于 session 外的 Agent 资产初始化
- `run` 才是 session 内的主入口
- 同一个 Agent 初始化一次后，应跨多个 session 复用

这样做的原因：

- 比常驻服务更容易验证
- 比纯内存原型更容易观察部署边界
- 比数据库原型更不容易过早锁定实现

## Minimal Deployment Layout

建议第一版目录布局如下：

```text
plans/mvp/
runtime/
agents/<agent_id>/identity/
agents/<agent_id>/memory/raw-capture/
agents/<agent_id>/memory/short-term/
agents/<agent_id>/runs/
```

目录职责：

- `agents/<agent_id>/identity/`
  - 放 `agent_identity` 资产文件
- `agents/<agent_id>/memory/raw-capture/`
  - 放 hooks/CLI 采集到的原始候选数据
- `agents/<agent_id>/memory/short-term/`
  - 放经 AI 过滤后的 short-term 事件文件
- `agents/<agent_id>/runs/`
  - 放每次运行的输入、输出和验证快照

## Minimal Data Boundaries

### 1. `agent_identity`

第一版只保留当前契约中最小身份字段：

- `agent_id`
- `canonical_name`
- `specialization`
- `mission`
- `lineage`

第一版要求：

- 文件可读
- 字段可校验存在
- 加载失败时明确报错

### 2. 短期记忆（过滤后）

第一版要求 short-term 必须来自过滤流程，不能直接由 hooks 原样落盘。

必填字段：

- `message_id`
- `identity_id`
- `object_kind`
- `object_ref`
- `event_type`
- `evidence_refs`
- `observed_at`

可选字段：

- `target_ref`

新增要求：

- hooks `run` 只写 `raw_capture`
- `distill` 命令使用推理模型将 `raw_capture` 转换为 short-term
- short-term 必须携带 `filtered_by_model` 与模型来源元数据

### 3. 当前冻结项（长期记忆）

MVP 当前阶段冻结长期记忆写入：

- 不做长期记忆准入判定
- 不写入长期记忆对象
- 不将短期事件自动晋升到长期层

## Minimal Process Lifecycle

第一版单进程建议固定为以下步骤：

1. 启动进程
2. 加载已初始化的 `agent_identity`
3. 校验运行所需目录和文件是否存在
4. 接收一次最小输入
5. 生成一条 `raw_capture` 事件
6. 将事件写入 `memory/raw-capture/`
7. 通过 `distill`（离线）执行 AI 过滤
8. 将通过过滤的对象写入 `memory/short-term/`
9. 输出运行摘要并退出

说明：

- 上述生命周期描述的是 `run`
- `init` 不属于每次 session 的固定步骤
- 若身份文件或目录缺失，`run` 应失败并提示先执行一次 `init`

## Service Process Management

虽然是单进程 MVP，计划中仍需明确进程管理边界。

第一版建议：

- 进程类型：CLI 驱动短生命周期进程
- 启动方式：本地命令直接启动
- 并发策略：第一版不支持并发写入
- 锁策略：第一版可用单目录独占或简单文件锁占位
- 失败恢复：失败时保留已写入文件，不做自动回滚
- 日志策略：每次运行输出一份最小运行摘要到 `runs/`

不建议第一版做：

- 常驻守护进程
- 多 worker
- 热重载
- 自动重试队列

## Reliability Verification Strategy

MVP 的重点是未来能逐步做可靠性验证，因此每一步都应有明确验证点。

### 验证点 1：身份加载

验证目标：

- 原型能读到 `agent_identity`
- 缺字段时能失败退出

### 验证点 2：短期记忆写入

验证目标：

- 每次运行都会生成一条事件文件
- 事件文件字段完整

### 验证点 3：离线过滤与 short-term 落点

验证目标：

- `distill` 可从 `raw_capture` 生成 short-term 文件
- short-term 文件包含模型过滤元数据

### 验证点 4：回读

验证目标：

- 原型在一次运行结束前能重新读取 short-term 目录中的最新对象（若存在）

### 验证点 5：重复运行

验证目标：

- 第二次运行不会破坏第一次生成的文件
- 目录结构与命名规则保持稳定

## Proposed Implementation Phases

### Phase 1: 定义最小资产与目录

交付物：

- `agent_identity` 文件格式
- 运行目录布局
- 初始化规则

验收：

- 目录可以一键初始化
- `agent_identity` 文件可以被静态校验

### Phase 2: 跑通单次链路

交付物：

- CLI 入口
- 一次性运行流程
- `raw_capture` 文件写入
- `distill` 到 short-term 的最小链路

验收：

- `run` 后看到 `raw_capture`
- `distill` 后看到 short-term

### Phase 3: 增加最小校验与失败路径

交付物：

- 输入校验
- 身份缺失报错
- 目录缺失自动初始化
- 最小运行日志

验收：

- 错误场景可复现、可解释

### Phase 4: 增加重复运行验证

交付物：

- 重复运行命令
- 基础不破坏性验证

验收：

- 连续多次运行仍能保持目录和文件稳定

## Recommended File Targets

计划阶段先建议，不在本文件中冻结实现语言：

- `plans/mvp/2026-04-01-codex-agent-identity-mvp-plan.md`
- `runtime/`
- `agents/<agent_id>/identity/`
- `agents/<agent_id>/memory/short-term/`
- `agents/<agent_id>/memory/raw-capture/`
- `agents/<agent_id>/runs/`

实现开始前还需要最终确认：

- CLI 入口文件放置位置
- `agent_identity` 文件格式是 JSON、YAML 还是 Markdown frontmatter
- 模型过滤输出的字段与版本管理策略

## Open Decisions To Resolve Before Implementation

1. `agent_identity` 文件格式选型
2. CLI 入口的命令行交互格式
3. `raw_capture` 与 short-term 文件的命名规则
4. 模型过滤输出字段与质量标签规范
5. 简单文件锁是否在第一版就需要

## Suggested Next Step

下一步不应直接扩展功能，而应先把以下两件事定死：

1. `agent_identity` 文件格式
2. 单进程 CLI 的最小交互命令

只有这两点稳定后，后续实现计划才不会漂移。

## Task Checklist

### Task 1: 固定文件格式与目录骨架

输出：

- 明确 `agent_identity` 文件格式
- 明确短期记忆事件文件格式
- 明确 raw_capture 与 short-term 文件格式
- 明确 `agents/<agent_id>/...` 目录骨架

完成标准：

- 三类文件都能给出最小字段定义
- 目录骨架可以直接创建

### Task 2: 定义 CLI 最小交互协议

输出：

- 一个初始化命令
- 一个单次运行命令
- 一个离线过滤命令
- 一个验证命令

完成标准：

- 命令输入输出字段固定
- 失败路径有最小错误语义

### Task 3: 实现身份加载与目录初始化

输出：

- 读取 `agent_identity`
- 校验最小字段
- 自动创建运行目录

完成标准：

- 缺身份文件时报错
- 目录不存在时可自动初始化

### Task 4: 实现短期记忆事件写入

输出：

- 生成一条 raw_capture 事件
- 将事件写入 raw-capture 目录

完成标准：

- 单次运行必然生成一条事件文件
- 事件字段满足当前采集信封草案

### Task 5: 实现离线 AI 过滤到 short-term

输出：

- 从 raw_capture 生成 short-term 对象
- 将结果写入 short-term 目录
- 提供 AI provider 环境变量配置

完成标准：

- short-term 目录中可看到新生成文件
- 文件包含来源 raw_capture 引用、过滤结果与质量标签

### Task 6: 实现单次运行摘要与回读

输出：

- 回读最新 short-term 对象
- 输出本次运行摘要
- 将摘要写入 `runs/`

完成标准：

- 一次运行结束前能看到 short-term 回读结果
- `runs/` 中有本次摘要文件

### Task 7: 增加失败路径和重复运行验证

输出：

- 缺字段报错
- 身份缺失报错
- 重复运行验证命令

完成标准：

- 错误场景可复现
- 连续两次运行不会破坏已有文件

## Execution Order

建议严格按以下顺序执行：

1. 固定文件格式
2. 固定 CLI 协议
3. 建目录和身份加载
4. 写短期记忆
5. 做离线 AI 过滤到 short-term
6. 做回读和运行摘要
7. 做失败路径和重复运行验证

## Minimum Acceptance Walkthrough

最终至少应存在这样一条可重复执行的验收路径：

1. 初始化一个实验性 `agent_identity`
2. 启动单次运行命令并传入最小输入
3. 在短期目录看到新事件文件
4. 执行 `distill` 后在 short-term 目录看到新对象
5. 在 `runs/` 看到本次摘要
6. 再运行一次，确认旧文件未损坏且新文件继续生成
