# 记忆蒸馏过程（memory distillation）

## 作用

定义 `dynamic_memory` 的对象形成与晋升流程，确保经验从案例到行为规则的升级可审阅、可追溯、可回退。

## 对象分层

- `Episode`：压缩后的证据与案例层
- `Learning`：跨案例提炼后的稳定经验层
- `Behavior Delta`：可执行行为增量（审阅态）

## 生命周期操作

- `encode`
- `store`
- `retrieve`
- `consolidate`
- `reconsolidate`
- `reflect`

## 推荐流水线

`encode -> Episode -> consolidate -> Learning -> reviewed Behavior Delta -> skill_pack update`

## 形成策略

- `hot path formation`：只热写少量高价值 `Episode`
- `background formation`：在后台执行 `consolidate / reconsolidate / reflect`

默认：`Learning` 与 `Behavior Delta` 优先后台形成。

## 晋升规则

### `Episode -> Learning`

要求可复用证据 + 最小反馈支撑；缺 `applicability / failure_conditions / evidence_refs` 不晋升。

### `Learning -> Behavior Delta`

要求可转化为明确行为改变，且有“行为改变后更好”的反馈证据。

### `Behavior Delta -> skill_pack update`

要求已审阅、跨实例验证、可迁移；门槛最高。

## 失效规则

- `keep`
- `update`
- `deprecate`
- `delete`

默认偏向 `update / deprecate`，避免激进删除导致演化历史丢失。

## 反思触发

- `event-driven`
- `batch-driven`
- `time-driven`
- `promotion-driven`

运行热路径仅响应强 `event-driven`。
