# Portable Agent Contract

本文档是 `Portable Agent Contract` 的主入口。

它只回答一个总问题：

`什么是一个可跨项目、跨环境即插即用的 Agent，本体最少由哪些对象构成，这些对象之间的边界在哪里？`

## 文档目标

- 固定 Agent 本体与外部环境的边界
- 为后续记忆模型、适配层和 Obsidian 角色判断提供统一基线
- 避免把工作区、项目、客户端后端能力误写进 Agent 本体

## 本文档不是

- 不是数据库 schema
- 不是 API 设计
- 不是部署方案
- 不是某个后端的适配说明

## 核心判断

一个可移植的 Agent，本体最少由四个核心对象组成：

1. `agent_identity`
2. `skill_pack`
3. `dynamic_memory`
4. `adapter_contract`

其中：

- `agent_identity` 定义“这是哪个 Agent”
- `skill_pack` 定义“这个 Agent 静态具备什么专业能力”
- `dynamic_memory` 定义“这个 Agent 通过经验持续学到了什么”
- `adapter_contract` 定义“这个 Agent 需要什么样的运行时适配能力，才能被挂接到具体环境”

## 子文档导航

- [agent-identity.md](./portable-agent-contract/agent-identity.md)
- [skill-pack.md](./portable-agent-contract/skill-pack.md)
- [dynamic-memory.md](./portable-agent-contract/dynamic-memory.md)
- [adapter-contract.md](./portable-agent-contract/adapter-contract.md)
- [relationship-map.md](./portable-agent-contract/relationship-map.md)

## 顶层边界

- `agent_identity` 只定义身份，不承载环境状态
- `skill_pack` 是静态、可分发的专业能力包
- `dynamic_memory` 是 Agent 专属的外挂长期经验层
- `adapter_contract` 只描述能力要求，不等于具体适配器实现

## 全局约束

- 本项目只关注 Agent 自身的专属技能和专属记忆
- 不纳入工作区记忆、项目记忆、团队知识库或通用知识库
- 不依赖特定工作区配置
- 不依赖单一 Agent 后端
- Obsidian 更适合作为稳定经验对象的文件型知识层，而不是高频运行时主存储

## 四对象关系

### 关系 1：身份约束

`agent_identity` 决定 Agent 的连续性。

`skill_pack`、`dynamic_memory`、`adapter_contract` 都服务于同一个身份，但都不能反向篡改身份定义。

### 关系 2：静态与动态分离

`skill_pack` 是静态可分发资产。  
`dynamic_memory` 是动态演化资产。

二者必须分离，否则系统会把临时经验直接污染成长期技能。

### 关系 3：环境与本体分离

`adapter_contract` 允许环境注入上下文，但不能决定 Agent 本体是什么。

换句话说，Agent 应该能脱离某个具体 adapter implementation 继续存在。

### 关系 4：行为升级路径

推荐的升级路径是：

`Episode -> Learning -> reviewed Behavior Delta -> skill_pack update`

### 关系 5：反馈闭环

推荐的反馈闭环是：

`run -> capture trace -> observe outcome -> attach feedback -> update memory state`

其中：

- `feedback_object` 是 `dynamic_memory` 的支持对象，不是第五个核心对象
- 反馈优先级默认应是：
  1. `environmental outcome feedback`
  2. `implicit behavior feedback`
  3. `explicit feedback`
  4. `self-reflection only`

## 阅读顺序建议

如果要继续细化设计，推荐顺序是：

1. 先读 [agent-identity.md](./portable-agent-contract/agent-identity.md)
2. 再读 [skill-pack.md](./portable-agent-contract/skill-pack.md)
3. 然后读 [dynamic-memory.md](./portable-agent-contract/dynamic-memory.md)
4. 最后读 [adapter-contract.md](./portable-agent-contract/adapter-contract.md)
