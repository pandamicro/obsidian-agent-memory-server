# Codex Agent Identity MVP Plan

**Goal:** 定义并实现一个面向 Codex 环境的实验性 `agent_identity` 可运行原型，用单进程、文件优先的极简方式串起身份加载、短期记忆写入、长期记忆落点与最小验证闭环。

**Architecture:** MVP 采用 `文件优先单进程`。一个本地进程负责加载 `agent_identity` 资产文件，接收最小输入，写入短期记忆事件，执行一个极简蒸馏步骤，并把结果落到长期记忆目录；所有状态以本地文件保存，优先保证链路清晰、目录边界明确、验证路径稳定。

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
4. 原型进程能执行一次极简长期记忆落点动作
5. 原型进程能从长期记忆目录读回一个结果或占位结果
6. 存在可重复运行的验证命令，证明整条链路可用

## MVP Non-Goals

- 不实现完整身份治理
- 不实现身份自动比对算法
- 不实现真实高质量蒸馏
- 不实现复杂长期检索排序
- 不实现多 Agent 协作
- 不实现跨环境同步
- 不实现 Obsidian 深度集成

## Minimal Runtime Shape

推荐第一版运行形态：

- 一个 CLI 驱动的短生命周期本地进程
- 启动时加载 `agent_identity`
- 处理单次输入
- 写入短期记忆事件文件
- 执行一次极简蒸馏或复制式晋升
- 写入长期记忆文件
- 输出本次运行摘要

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
agents/<agent_id>/memory/short-term/
agents/<agent_id>/memory/long-term/
agents/<agent_id>/runs/
```

目录职责：

- `agents/<agent_id>/identity/`
  - 放 `agent_identity` 资产文件
- `agents/<agent_id>/memory/short-term/`
  - 放短期记忆事件文件
- `agents/<agent_id>/memory/long-term/`
  - 放长期记忆对象或占位对象
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

### 2. 短期记忆

第一版只要求能写一条最小公共信封事件。

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

第一版不要求：

- 复杂反馈聚合
- 完整状态机
- 检索优化

### 3. 长期记忆

第一版只要求生成一个“长期记忆占位对象”或极简对象。

最低要求：

- 能从短期记忆输入生成一个长期目录下的文件
- 文件里至少保留：
  - 来源事件引用
  - 生成时间
  - 极简摘要或占位结论

第一版允许：

- 直接把短期事件转写为长期占位对象
- 不要求真实高质量 `Learning / Behavior Delta`

## Minimal Process Lifecycle

第一版单进程建议固定为以下步骤：

1. 启动进程
2. 加载 `agent_identity`
3. 校验目录是否存在，不存在则初始化
4. 接收一次最小输入
5. 生成一条短期记忆公共信封事件
6. 将事件写入短期记忆目录
7. 触发一次极简蒸馏
8. 将结果写入长期记忆目录
9. 读取长期记忆目录中的最新对象
10. 输出运行摘要并退出

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

### 验证点 3：长期记忆落点

验证目标：

- 每次运行至少生成一个长期结果文件或占位结果文件

### 验证点 4：回读

验证目标：

- 原型在一次运行结束前能重新读取长期目录中的最新对象

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
- 短期记忆文件写入
- 长期记忆占位对象写入

验收：

- 一条命令跑完加载、写入、落点、回读

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
- `agents/<agent_id>/memory/long-term/`
- `agents/<agent_id>/runs/`

实现开始前还需要最终确认：

- CLI 入口文件放置位置
- `agent_identity` 文件格式是 JSON、YAML 还是 Markdown frontmatter
- 长期记忆占位对象文件格式

## Open Decisions To Resolve Before Implementation

1. `agent_identity` 文件格式选型
2. CLI 入口的命令行交互格式
3. 短期记忆与长期记忆文件的命名规则
4. 长期记忆第一版的占位对象格式
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
- 明确长期记忆占位对象文件格式
- 明确 `agents/<agent_id>/...` 目录骨架

完成标准：

- 三类文件都能给出最小字段定义
- 目录骨架可以直接创建

### Task 2: 定义 CLI 最小交互协议

输出：

- 一个初始化命令
- 一个单次运行命令
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

- 生成一条最小公共信封事件
- 将事件写入短期记忆目录

完成标准：

- 单次运行必然生成一条事件文件
- 事件字段满足当前公共信封草案

### Task 5: 实现极简长期记忆落点

输出：

- 从短期事件生成一个长期记忆占位对象
- 将结果写入长期记忆目录

完成标准：

- 长期目录中可看到新生成文件
- 文件包含来源事件引用与时间戳

### Task 6: 实现单次运行摘要与回读

输出：

- 回读最新长期对象
- 输出本次运行摘要
- 将摘要写入 `runs/`

完成标准：

- 一次运行结束前能看到长期对象回读结果
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
5. 写长期记忆
6. 做回读和运行摘要
7. 做失败路径和重复运行验证

## Minimum Acceptance Walkthrough

最终至少应存在这样一条可重复执行的验收路径：

1. 初始化一个实验性 `agent_identity`
2. 启动单次运行命令并传入最小输入
3. 在短期目录看到新事件文件
4. 在长期目录看到新占位对象
5. 在 `runs/` 看到本次摘要
6. 再运行一次，确认旧文件未损坏且新文件继续生成
