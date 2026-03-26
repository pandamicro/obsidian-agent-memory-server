# Portable Agent Contract（最小模型）

本文档定义 `obsidian-agent-memory-server` 在研究阶段采用的 `Portable Agent Contract` 最小模型。

它只回答一个问题：

`什么是一个可跨项目、跨环境即插即用的 Agent，本体最少由哪些对象构成，这些对象之间的边界在哪里？`

本文档不是：

- 不是数据库 schema
- 不是 API 设计
- 不是部署方案
- 不是某个后端的适配说明

## 文档目标

- 固定 Agent 本体与外部环境的边界
- 为后续记忆模型、适配层和 Obsidian 角色判断提供统一基线
- 避免把工作区、项目、客户端后端能力误写进 Agent 本体

## 核心判断

一个可移植的 Agent，本体最少由四个核心对象组成：

1. `agent_identity`
2. `skill_pack`
3. `dynamic_memory`
4. `runtime_adapter`

其中：

- `agent_identity` 定义“这是哪个 Agent”
- `skill_pack` 定义“这个 Agent 静态具备什么专业能力”
- `dynamic_memory` 定义“这个 Agent 通过经验持续学到了什么”
- `runtime_adapter` 定义“这个 Agent 如何被挂接到具体运行环境”

## 最小模型

### 1. `agent_identity`

#### 作用

定义 Agent 的连续性与唯一性，回答“这是不是同一个 Agent”。

#### 最小组成

- `agent_id`
  - 稳定且可迁移的唯一标识
- `canonical_name`
  - Agent 的标准名称
- `specialization`
  - Agent 的专业方向或岗位标签
- `mission`
  - Agent 长期稳定的职责描述
- `lineage`
  - Agent 的来源或演化关系标识，用于区分“升级后的同一 Agent”和“全新 Agent”

#### 边界

`agent_identity` 只定义身份，不定义技能细节，不保存动态经验，也不承载运行环境状态。

#### 禁止混入

- 工作区路径
- 项目状态
- 临时任务上下文
- 后端配置
- 运行时学到的临时经验

### 2. `skill_pack`

#### 作用

定义 Agent 的静态、可分发、可移植的专业能力包。

#### 最小组成

- `role_brief`
  - 角色说明与工作边界
- `operating_principles`
  - 长期稳定的行为原则
- `method_patterns`
  - 该 Agent 默认采用的方法模板与推理路径
- `quality_bar`
  - 对输出质量、验证和风险控制的最低要求
- `capability_requirements`
  - 需要什么类型的外部能力，但只写抽象能力，不绑定具体工具实现

#### 边界

`skill_pack` 是静态资产，定义 Agent 应当如何工作，而不是记录它这次运行学到了什么。

#### 禁止混入

- 原始案例堆积
- 临时结论
- 未审阅的行为调整
- 某个具体后端的专有命令或硬编码配置

### 3. `dynamic_memory`

#### 作用

定义 Agent 持续积累的专属经验层。

它的目标不是保存一切，而是保存未来仍能稳定提升该 Agent 行为质量的经验。

#### 核心判断

高价值经验至少要包含三类信息：

- `情境`
  - 在什么条件下触发
- `策略`
  - 当时采用了什么判断路径或方法
- `结果`
  - 为什么有效、何时失效、可信度如何

只有事实，没有适用情境，不够。

只有案例，没有可提炼规律，不够。

只有规则，没有证据来源，也不够。

#### 最小分层

##### `Episode`

压缩后的原始经验与证据层。

最小组成：

- `episode_id`
- `situation`
- `decision_path`
- `action`
- `outcome`
- `source`
- `timestamp`
- `confidence`

作用：

- 保留经验来源
- 支持回放与追溯
- 为后续提炼提供证据

##### `Learning`

从一个或多个 `Episode` 提炼出的稳定经验层。

最小组成：

- `learning_id`
- `claim`
- `applicability`
- `failure_conditions`
- `evidence_refs`
- `confidence`
- `last_verified_at`

作用：

- 作为 Agent 的主要可检索经验对象
- 为未来决策提供高效指导

##### `Behavior Delta`

会影响 Agent 行为的高价值经验增量。

最小组成：

- `delta_id`
- `proposed_change`
- `reason`
- `evidence_refs`
- `review_state`
- `promotion_target`

作用：

- 承接“经验是否值得升级为长期行为规则”这一判断
- 作为 `dynamic_memory` 与 `skill_pack` 之间的缓冲层

#### 边界

`dynamic_memory` 是 Agent 的专属经验，不是工作区日志，也不是项目状态库，更不是通用知识库。

#### 禁止混入

- 原始聊天全文
- 高频 scratchpad
- 工作区配置
- 项目待办
- 与 Agent 专业能力无关的杂项事实

### 4. `runtime_adapter`

#### 作用

定义同一个 Agent 如何接入 Claude Code、Codex、MCP、Obsidian 或其他运行环境。

#### 最小组成

- `adapter_id`
- `backend_kind`
- `capability_map`
- `context_injection_policy`
- `persistence_policy`
- `failure_fallbacks`

#### 边界

`runtime_adapter` 是桥接层，不是 Agent 本体。它负责翻译环境，不负责重新定义 Agent 身份、技能或记忆本体。

#### 禁止混入

- Agent 专属经验本体
- 长期角色定义
- 工作区专属脏状态被错误持久化回 Agent

## 四对象关系

### 关系 1：身份约束

`agent_identity` 决定 Agent 的连续性。

`skill_pack`、`dynamic_memory`、`runtime_adapter` 都服务于同一个身份，但都不能反向篡改身份定义。

### 关系 2：静态与动态分离

`skill_pack` 是静态可分发资产。  
`dynamic_memory` 是动态演化资产。

二者必须分离，否则系统会把临时经验直接污染成长期技能。

### 关系 3：环境与本体分离

`runtime_adapter` 可以注入上下文，但不能决定 Agent 本体是什么。

换句话说，Agent 应该能脱离某个特定 adapter 继续存在。

### 关系 4：行为升级路径

推荐的升级路径是：

`Episode -> Learning -> reviewed Behavior Delta -> skill_pack update`

这条路径的意义是：经验可以演化为长期能力，但必须经过提炼与审阅，不能直接从原始经验改写技能包。

## 必须留在外部环境的信息

下列信息不属于 Agent 本体，应严格留在外部环境：

- 工作区目录结构
- 项目状态、项目任务、项目决策
- 团队级知识库
- 通用知识库
- 当前会话的 scratchpad
- 后端专属配置
- 机密凭证和本地运行时状态

这些信息可以被运行时临时注入，但不应直接持久化回 Agent 本体。

## 对 Obsidian 的含义

在这个最小模型下，Obsidian 更适合作为：

- `Learning` 的沉淀与审阅载体
- 稳定 `Behavior Delta` 的长期记录载体
- Agent 经验手册的维护界面

Obsidian 不适合直接承担：

- 高频 `Episode` 热写入总线
- 运行时 scratch memory
- 唯一的动态记忆后端

## 当前非目标

本文档暂不定义：

- 精确字段类型
- 序列化格式
- API 协议
- 存储引擎
- 检索算法
- Promotion 的自动化阈值

## 下一步

- 细化 `agent_identity` 的最小字段边界
- 细化 `skill_pack` 的结构边界
- 细化 `Episode` / `Learning` / `Behavior Delta` 的字段边界
- 定义 `runtime_adapter` 的最小兼容契约
