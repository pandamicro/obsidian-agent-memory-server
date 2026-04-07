# 短期记忆反馈（short-term feedback）

## 作用

定义 `dynamic_memory` 在短周期内如何收集、归并和挂接反馈，避免经验判断只靠主观反思。

## 最小闭环

`run -> capture trace -> observe outcome -> attach feedback -> update memory state`

缺少 `observe outcome` 或 `attach feedback` 时，只能说明“经验被生成过”，不能说明“经验有效”。

## feedback_object（支持对象）

`feedback_object` 不是第五个核心对象，而是 `dynamic_memory` 的支持对象。

### 最小字段

- `feedback_id`
- `target_ref`
- `signal_type`
- `polarity`
- `evidence_refs`
- `observed_at`

### 信号类型

- `explicit`
- `implicit_behavior`
- `environmental_outcome`
- `review_trace`

### 默认优先级

1. `environmental_outcome`
2. `implicit_behavior`
3. `explicit`
4. `self-reflection only`

## 数据准入标准

只有同时满足以下条件的数据，才进入记忆判断链路：

- `observable`
- `linkable`
- `evaluatable`
- `distillable`

## MVP 质量要求（短期记忆专用）

当前 MVP 只约束短期记忆质量，不做长期记忆准入判断。

最小要求：

- 每条短期事件必须携带 `source_kind`
- 若来源为 hook flush，必须尽量结构化提取 `session_id`、`assistant_summary`、`candidates[]`
- 每条短期事件必须包含 `quality` 对象，并至少给出：
  - `observable`
  - `linkable`
  - `evaluatable`
  - `distillable`
  - `status`
- `status` 仅用于短期采集质量分层（如 `pass` / `needs_review`），不触发长期晋升

## feedback aggregation（第一阶段）

目标是形成方向判断，而不是精确打分。

最小输出：

- `supporting`
- `conflicting`
- `insufficient`

## state transition threshold（第一阶段）

第一阶段采用条件阈值，不冻结数值。

- `ready`
- `hold`
- `review`
- `block`

## 边界

`feedback_object` 引用证据，不复制全量 transcript、全量工具日志或工作区快照。
