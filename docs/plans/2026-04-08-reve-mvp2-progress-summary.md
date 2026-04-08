# Reve MVP2 Progress Summary

- 日期: 2026-04-08
- 范围: `projects/reve`
- 目标: 总结 MVP2 当前在 `raw_capture -> Episode -> Learning` 离线蒸馏链路上的实现进度、验证结果与剩余问题

## 当前状态

MVP2 的核心离线驱动器已经落地并验证过真实 provider：

- `distill`: `raw_capture -> short-term Episode`
- `consolidate`: `Episode -> long-term Learning`
- `drive`: 串行编排 `distill + consolidate`

当前实现已经具备：

- 基于文件系统的输入/输出路径
- `Learning` 最小对象模型
- 固定窗口 batching
- `Learning` 指纹幂等
- 每 agent / 每命令锁文件
- consolidate staged write 与失败回滚
- run summary 记录成功 / 失败 / 跳过状态
- `config.toml + env` 联动 provider/model 解析
- 真实 provider (`codex` + `gpt-5.2`) 验证

## 已完成任务

对应实现提交：

1. `41613bf` `feat: add basic reve consolidate command`
2. `16a16fc` `feat: define learning outputs for reve consolidation`
3. `306e7b5` `feat: add fixed-window batching for reve consolidation`
4. `317592c` `feat: add learning idempotency to reve`
5. `d2deb92` `feat: add reve lock files and failure-safe runs`
6. `4100256` `feat: add reve offline drive workflow`
7. `9479a38` `fix: make reve consolidate schema provider-compatible`

补充研究记录提交：

1. `beaed7a` `docs: record unity optimization distillation validation`

## 已验证能力

### 1. Research Agent 真实验证

- `distill` 成功生成 short-term episode
- `consolidate` 与 `drive` 在修复 provider schema 后可稳定成功
- 结果为 `needs_more_evidence`

结论：

- 链路已跑通
- 当前输入样本不足以形成长期记忆
- 主要瓶颈在 short-term episode 质量，而不是 provider 连通性

### 2. Unity Optimization Agent 真实验证

- 隔离目录只复制 `identity + raw_capture`
- 真实 `distill` 处理 8 条 `raw_capture`
- 生成 8 条 episode：
  - `pass = 4`
  - `needs_review = 4`
- 真实 `consolidate --batch-size 4` 产出 2 条 `Learning`
- `drive` 二次运行不重复创建 `Learning`

结论：

- 当前 MVP2 已证明能从真实 agent 数据中产出长期记忆
- 幂等性正常
- 长期记忆质量仍明显受 batching 纯度影响

## 当前质量判断

### 已证明可用的部分

- 离线蒸馏链路可真实运行，不依赖 mock
- 对结构化、重复出现、可观察的 episode，模型可以形成可复用 `Learning`
- provider 配置链路已经打通，`config.toml` 与 env 可联动

### 仍然明显不足的部分

- short-term 质量波动大
- direct_input 类 `raw_capture` 容易进入“请求 / 提问 / 截断回答”型 episode
- 固定窗口 batching 会把跨主题 episode 合并，导致 learning 过宽、`needs_review`
- evidence refs 目前常常只有 `input:<message_id>`，缺少更细粒度上下文锚点

## 当前最关键的风险

1. short-term episode 主题纯度不足
2. consolidate 缺少主题分桶，只按时间窗口切批
3. direct_input 与 hook_flush 的信息密度差异较大，但当前入口过滤策略还不够强
4. 产出的 `Learning` 质量很依赖输入批次，尚未形成稳定的 operator policy

## 对 MVP2 的结论

MVP2 第一阶段可以视为：

- 核心离线驱动器已完成
- 真实 provider 连通性已验证
- 长期记忆最小产物 `Learning` 已验证可生成

但还不能视为“记忆质量已稳定”。

当前更准确的状态是：

- 链路层: 可用
- 结构层: 可用
- 质量层: 需要继续收敛 short-term 过滤与 batching 策略

## 下一阶段建议

优先级应继续停留在 MVP2 范围内，不扩大对象边界：

1. 强化 short-term 准入质量
2. 研究 consolidate 前的轻量主题分桶
3. 更强地过滤纯请求 / 纯澄清类 episode
4. 提升 evidence refs 的可回链性

不建议当前优先做：

- 新增长期对象类型
- 引入实时后台调度
- 扩大到长期记忆写回策略以外的问题域
