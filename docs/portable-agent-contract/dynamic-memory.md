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
