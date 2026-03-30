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
