# 长期记忆索引（long-term memory index）

## 作用

定义 `agent_identity` 在长期记忆场景下的检索锚点、提取目标和注入策略。

核心目标不是“检索最多内容”，而是“以最小噪声拿到最可执行的长期行为依据”。

## 索引锚点

长期记忆索引语义挂在：

`agent_identity -> Behavior Delta`

补充入口：

- `agent_identity ..> Episode`（证据回溯）
- `agent_identity -> skill_pack`（静态能力基线）

说明：`Episode` 不是长期检索主目标，只作为证据追溯与蒸馏输入。

## 检索对象优先级

默认检索优先级：

1. `Behavior Delta`（可执行增量）
2. `skill_pack`（静态基线）
3. `Learning`（补充解释）
4. `Episode`（证据回放）

## 提取模式

### 模式 A：仅提取 `skill_pack`

适用：

- 冷启动
- 高风险任务
- Delta 命中不足或审阅状态不达标

目标：先建立稳定边界，避免执行漂移。

### 模式 B：仅提取 `Behavior Delta`

适用：

- 行为差异审计
- 复盘“近期为什么改变了做法”
- 专项分析而非直接执行

目标：观察行为增量本身，不混入基线噪声。

### 模式 C：联合提取 `skill_pack + Behavior Delta`（默认）

适用：

- 正式执行任务
- 已有可审阅 Delta 且情境命中

执行顺序：

1. 先注入 `skill_pack`
2. 再叠加 `Behavior Delta`
3. 冲突时保持 `skill_pack` 优先，低置信 Delta 自动降级为参考

## 提取门控

### `Behavior Delta` 可注入条件

至少满足：

- `review_state` 处于可执行状态
- `applicability` 命中当前任务情境
- 存在有效 `evidence_refs`
- 最近反馈未触发 `deprecate / delete`

否则：

- 只作为候选展示
- 不进入执行上下文

### `skill_pack` 可注入条件

默认可注入；只有在以下情形降级：

- 目标环境与 `capability_requirements` 明显不匹配
- 已被明确标记待替换版本（迁移窗口）

## 结果可见性分层

- `execution_visible`
  - 可以直接注入到执行上下文
- `review_visible`
  - 只对审阅流程可见，不可直接驱动执行
- `trace_visible`
  - 仅用于证据追溯

推荐映射：

- `skill_pack`：默认 `execution_visible`
- `Behavior Delta`：按 `review_state` 在 `execution_visible / review_visible` 之间切换
- `Episode`：默认 `trace_visible`

## 最小索引字段建议

### Behavior Delta 索引字段

- `delta_id`
- `identity_id`
- `review_state`
- `applicability`
- `promotion_target`
- `evidence_refs`
- `last_verified_at`
- `state`（`keep / update / deprecate / delete`）

### skill_pack 索引字段

- `identity_id`
- `version`
- `role_brief`
- `operating_principles`
- `method_patterns`
- `quality_bar`

## 检索决策表

| intent | 默认提取 | 说明 |
|---|---|---|
| `execute` | `skill_pack + Behavior Delta` | 先基线后增量 |
| `baseline_only` | `skill_pack` | 稳定优先 |
| `delta_audit` | `Behavior Delta` | 差异审计优先 |
| `traceback` | `Behavior Delta + Episode` | 证据回放 |

## 风险与防护

- 风险：把未审阅 Delta 注入执行，造成行为震荡
  - 防护：`review_visible` 与 `execution_visible` 强隔离
- 风险：只检索 Delta 忽略基线，导致局部最优
  - 防护：`execute` 场景默认联合提取
- 风险：Episode 被误当长期规则
  - 防护：Episode 限定为 `trace_visible`

## 与 Obsidian 文件层的关系

Obsidian 适合承载可审阅、可版本化的长期对象：

- 已稳定 `Learning`
- 已审阅 `Behavior Delta`
- 发布态 `skill_pack`

不建议在 Obsidian 上承担高频运行时索引更新。
