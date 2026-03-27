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
4. `adapter_contract`

其中：

- `agent_identity` 定义“这是哪个 Agent”
- `skill_pack` 定义“这个 Agent 静态具备什么专业能力”
- `dynamic_memory` 定义“这个 Agent 通过经验持续学到了什么”
- `adapter_contract` 定义“这个 Agent 需要什么样的运行时适配能力，才能被挂接到具体环境”

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

#### 生命周期操作

`dynamic_memory` 不只是存储结构，还需要一套最小生命周期操作。

建议保留以下六类操作：

- `encode`
  - 从运行过程识别值得保留的经验线索，并压缩成 `Episode`
- `store`
  - 将 `Episode`、`Learning`、`Behavior Delta` 以可追溯形式持久化
- `retrieve`
  - 按情境、任务类型、失败模式或证据关联检索可用经验
- `consolidate`
  - 将多个 `Episode` 提炼成更稳定的 `Learning`
- `reconsolidate`
  - 在新证据到来后修正已有 `Learning` 或 `Behavior Delta`
- `reflect`
  - 主动回顾高价值经验，判断哪些值得升级、降级、合并或废弃

推荐的最小流水线：

`encode -> Episode -> consolidate -> Learning -> reviewed Behavior Delta -> skill_pack update`

其中 `retrieve` 会作用于整个过程，`reconsolidate` 和 `reflect` 用于防止记忆老化、误导或重复堆积。

#### 形成策略

记忆形成至少应分成两条路径：

- `hot path formation`
  - 在运行中即时写入少量高价值 `Episode`
  - 只处理强信号，避免显著增加交互延迟或污染当前任务
- `background formation`
  - 在运行后或空闲期执行 `consolidate / reconsolidate / reflect`
  - 负责模式发现、经验归并、冲突修正和晋升判断

当前更合理的默认值是：

- `Episode` 可以少量热写入
- `Learning` 和 `Behavior Delta` 优先由后台反思生成

这样做的原因很直接：如果把经验提炼和行为晋升都塞进运行热路径，系统会把“完成当前任务”和“管理长期记忆”混成一个负担，既增加延迟，也更容易产生噪音记忆。

#### 与文件型知识层的关系

`dynamic_memory` 不要求直接以 Markdown 为运行时主存储。

更稳妥的做法是分两层：

- 运行时记忆层
  - 负责写入、更新、检索 Agent 专属经验对象
- 文件型知识层
  - 负责将稳定的 `Learning` 或已审阅的 `Behavior Delta` 以人类可读形式沉淀、审阅和版本化

如果使用 Obsidian，它更适合承担第二层，而不是直接承担高频运行时写入。

#### 晋升规则

`dynamic_memory` 不应默认“只增不改”。不同层之间需要明确晋升门槛。

##### `Episode -> Learning`

满足以下条件之一时，`Episode` 才应被提炼为 `Learning`：

- 多个独立 `Episode` 指向同一可复用判断
- 单个 `Episode` 具有高置信度且结果被外部验证
- 该经验已经在不同任务或环境中复现

即使满足以上条件，也仍需补全：

- `applicability`
- `failure_conditions`
- `evidence_refs`

如果这些信息缺失，说明它还只是案例，不是稳定经验。

##### `Learning -> Behavior Delta`

满足以下条件时，`Learning` 才应晋升为 `Behavior Delta`：

- 该经验已经足够稳定，能转化为明确行为改变
- 该行为改变能被审阅，而不是模糊的“以后更注意”
- 预期收益大于潜在副作用

##### `Behavior Delta -> skill_pack update`

满足以下条件时，`Behavior Delta` 才应升级为 `skill_pack`：

- 已经过审阅
- 已在多次运行中证明有效
- 不依赖单一工作区、单一项目或单一后端偶然条件

这一步本质上是“把经验升级为角色能力”，门槛必须最高。

#### 失效规则

记忆失效不应只有“保留”或“删除”两种动作，至少应支持以下四类状态变化：

- `keep`
  - 仍然有效，无需调整
- `update`
  - 主体仍成立，但表述、边界或证据需要修正
- `deprecate`
  - 暂不删除，但已不适合作为默认依据
- `delete`
  - 已确认错误、冲突或越界，应移出有效记忆集

触发失效处理的典型信号：

- 新证据与旧记忆冲突
- 旧经验在新环境中连续失败
- 记忆长期未被命中且重要性持续下降
- 该记忆被发现依赖特定项目、工作区或后端细节，违反可移植边界

默认策略应偏向 `update / deprecate`，而不是激进删除。原因是长期记忆需要保留演化痕迹，便于回溯为什么某条经验失效。

#### 反思触发

`reflect` 不应无限频触发，否则会把系统拖成“总在整理记忆而不工作”。

更合理的最小触发源包括：

- `event-driven`
  - 出现显著成功、显著失败、重复错误、用户纠正、外部验证结果
- `batch-driven`
  - 达到一定数量的新 `Episode` 后，集中执行一次 `consolidate / reconsolidate`
- `time-driven`
  - 在空闲期或定期窗口执行记忆维护
- `promotion-driven`
  - 某条 `Learning` 准备晋升为 `Behavior Delta` 或 `skill_pack` 前，强制触发审阅

推荐的默认优先级：

- 运行时只响应强 `event-driven` 触发
- 其余反思尽量放到 `batch-driven` 或 `time-driven` 路径

这样可以避免热路径被记忆管理噪音淹没。

#### 范围限定

本项目当前只关注 `Agent 可外化、可迁移、可审阅的长期专属记忆`。

明确不纳入当前核心范围的包括：

- 上下文窗口中的工作记忆
- 模型参数内部的隐式记忆
- 通用知识库或项目知识库
- 纯运行时 scratchpad

这意味着本项目里的 `dynamic_memory`，默认是 Agent 专属的外挂长期记忆层，而不是对整个认知系统做全覆盖建模。

#### 边界

`dynamic_memory` 是 Agent 的专属经验，不是工作区日志，也不是项目状态库，更不是通用知识库。

#### 禁止混入

- 原始聊天全文
- 高频 scratchpad
- 工作区配置
- 项目待办
- 与 Agent 专业能力无关的杂项事实

### 4. `adapter_contract`

#### 作用

定义同一个 Agent 需要什么样的运行时适配能力，才能接入 Claude Code、Codex、MCP、Obsidian 或其他运行环境。

这里强调的是 `Contract`，不是具体适配器实现。

- `adapter_contract` 属于 Agent 本体模型的一部分
- 具体的 adapter implementation 属于外部环境，可以被多个 Agent 共享

换句话说：

- Agent 需要声明“我要求什么能力表面”
- 环境负责提供“哪个适配器实例来满足这些能力”

#### 最小组成

- `adapter_kind`
- `required_capabilities`
- `capability_map`
- `context_injection_policy`
- `persistence_policy`
- `failure_fallbacks`

#### 边界

`adapter_contract` 描述桥接要求，但不等于桥接实现本身。它不能重新定义 Agent 身份、技能或记忆本体。

#### 禁止混入

- Agent 专属经验本体
- 长期角色定义
- 工作区专属脏状态被错误持久化回 Agent
- 某个具体部署环境的本地路径或硬编码实例信息

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

## 显性记忆与隐性记忆

如果借鉴人类记忆里的显性记忆（explicit memory）和隐性记忆（implicit memory），本项目里更合理的映射是：

- `显性记忆`
  - 可以被明确检索、审阅、解释的记忆
  - 对应这里的 `Episode` 与 `Learning`
- `隐性记忆`
  - 不直接以“案例或事实”出现，而表现为行为倾向、默认策略、熟练化路径
  - 对应这里的 `Behavior Delta` 被审核后逐步影响 `skill_pack` 的过程

这带来一个重要设计判断：

- 第一版系统不应把“隐性记忆”设计成不可审计的黑盒状态
- 更合理的做法是把隐性记忆操作化为“被验证过的行为增量”

也就是说，隐性记忆不是不要，而是不应该以不可解释的形式存在。

推荐路径：

`Episode -> Learning -> reviewed Behavior Delta -> skill_pack update`

这条路径本质上就是把显性经验逐步程序化成稳定行为。

## 知识与经验

### 定义

#### `经验`

经验是有情境约束的、由行动和结果支撑的可迁移判断材料。

它至少包含：

- 在什么情境下
- 采取了什么策略
- 产生了什么结果

#### `知识`

知识是脱离具体单次情境后，仍然成立或可复用的稳定表述。

它可以是：

- 事实
- 关系
- 规律
- 方法性结论

### 二者关系

在本项目里：

- `Episode` 更接近经验
- `Learning` 更接近由经验提炼出的知识
- `Behavior Delta` 更接近由知识进一步转化出的行为调整

所以经验和知识不是二选一关系，而是一个递进关系。

### 本项目应排除什么

本项目应排除：

- 通用知识库
- 与 Agent 专业角色无关的事实性知识堆积
- 工作区/项目知识库
- 面向所有 Agent 共享的开放知识记忆系统

### 本项目不应排除什么

本项目不应排除：

- 从 Agent 自身经验中提炼出的操作性知识
- 能稳定提升该 Agent 专业表现的启发式、反模式、适用条件
- 会被后续行为复用的经验性结论

因此，更准确的说法不是“排除知识性记忆”，而是：

`排除通用知识型记忆，保留经验驱动、Agent 专属、可操作的知识化结论。`

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
- 定义 `adapter_contract` 的最小兼容契约
