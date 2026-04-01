# dynamic_memory

## 作用

定义 Agent 持续积累的专属经验层。

其目标不是保存一切，而是沉淀未来仍能稳定提升行为质量的经验对象。

## 核心对象

- `Episode`：证据与案例层
- `Learning`：稳定经验层
- `Behavior Delta`：可执行行为增量（审阅态）

## 推荐主链路

`encode -> Episode -> consolidate -> Learning -> reviewed Behavior Delta -> skill_pack update`

## 公共信封（第一阶段草案）

为减少 `short-term feedback`、`memory distillation`、`long-term memory index` 之间的数据分叉，当前阶段先定义一个最小公共信封。

这个公共信封只服务跨流程通信，不等于 `Episode / Learning / Behavior Delta / feedback_object` 的完整对象结构。

### 目标

- 统一流程之间的最小通信接口
- 支撑短期记忆触发、蒸馏衔接、长期提取入口
- 在不冻结对象内部结构的前提下，减少字段命名漂移

### 最小字段

必填：

- `message_id`
- `identity_id`
- `object_kind`
- `object_ref`
- `event_type`
- `evidence_refs`
- `observed_at`

可选：

- `target_ref`

### 字段说明

- `message_id`
  - 当前信封消息的唯一标识
- `identity_id`
  - 当前消息所属的 `agent_identity`
- `object_kind`
  - 当前承载对象类型，如 `episode / learning / behavior_delta / feedback_object`
- `object_ref`
  - 当前承载对象的稳定引用
- `event_type`
  - 当前流程动作类型，如 `captured / attached / promoted / retrieved / injected`
- `evidence_refs`
  - 当前消息附带的证据引用集合
- `observed_at`
  - 当前消息对应事件被观察到的时间
- `target_ref`
  - 可选，表示该消息作用于哪个对象；主要用于 `feedback_object` 场景

### 边界

- 公共信封不承载完整对象内容
- 公共信封不承载流程控制参数
- 对象内部字段继续留在各自流程文档中定义

### 当前不进入公共信封的字段

以下字段保留在对象层或流程层，当前不进入公共信封：

- `review_state`
- `visibility`
- `state`
- `applicability`
- `created_at`
- `updated_at`

原因：这些字段更接近对象状态或流程门控，不属于第一阶段最小通信必需字段

## 文件层定位

`dynamic_memory` 不要求 Markdown 作为运行时主存储。

更稳妥的做法是分层：

- 运行时记忆层：负责高频写入、更新、检索
- 文件型知识层：负责稳定对象沉淀、审阅、版本化

Obsidian 更适合第二层。

## 子文档导航

- [短期记忆反馈（short-term-feedback.md）](./dynamic-memory/short-term-feedback.md)
- [记忆蒸馏过程（memory-distillation.md）](./dynamic-memory/memory-distillation.md)
- [长期记忆索引（long-term-memory-index.md）](./dynamic-memory/long-term-memory-index.md)

## 边界

`dynamic_memory` 是 Agent 专属经验，不是工作区日志、项目状态库或通用知识库。

## 禁止混入

- 原始聊天全文
- 高频 scratchpad
- 工作区配置
- 项目待办
- 与 Agent 专业能力无关的杂项事实
