# dynamic_memory

## 作用

定义 Agent 持续积累的专属经验层。

它的目标不是保存一切，而是保存未来仍能稳定提升该 Agent 行为质量的经验。

## 核心判断

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

## 最小分层

### `Episode`

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

### `Learning`

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

### `Behavior Delta`

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

## 生命周期操作

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

## 形成策略

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

## 与文件型知识层的关系

`dynamic_memory` 不要求直接以 Markdown 为运行时主存储。

更稳妥的做法是分两层：

- 运行时记忆层
  - 负责写入、更新、检索 Agent 专属经验对象
- 文件型知识层
  - 负责将稳定的 `Learning` 或已审阅的 `Behavior Delta` 以人类可读形式沉淀、审阅和版本化

如果使用 Obsidian，它更适合承担第二层，而不是直接承担高频运行时写入。

## 反馈机制

如果没有反馈机制，`dynamic_memory` 的晋升与失效都只能停留在理论判断。

对本项目而言，判断“某条经验是否真的有帮助”，不能只依赖 Agent 自我反思，至少应组合四类反馈信号：

### 1. `explicit feedback`

由用户、审阅者或上级 Agent 明确给出的反馈，例如：

- 接受 / 拒绝某次结果
- 明确纠正
- 评分
- 自然语言批注

这是最直接的信号，但通常稀疏、主观、覆盖不均。

### 2. `implicit behavior feedback`

从实际使用行为中推断的反馈，例如：

- 用户是否沿用了 Agent 的产出
- 用户是否手动改写了关键部分
- 某条建议是否被真正执行
- 同类任务中，该经验是否被重复检索和复用

这类信号通常比显式反馈更连续，也更接近真实价值。

### 3. `environmental outcome feedback`

由外部环境返回的任务结果信号，例如：

- 测试是否通过
- 构建是否成功
- 工具调用是否完成目标
- 任务是否闭环
- 下游系统是否接受该输出

这是判断经验是否“在现实里有效”的关键来源。

### 4. `review and trace feedback`

基于运行轨迹和人工复核得到的结构化判断，例如：

- trace grading
- transcript review
- 对工具调用链和中间决策的复盘
- 针对失败案例的人工标注

这类信号不是实时的，但对发现“为什么有效/为什么失效”非常重要。

## 反馈优先级

默认应采用以下优先级来判断经验帮助度：

1. `environmental outcome feedback`
2. `implicit behavior feedback`
3. `explicit feedback`
4. `self-reflection only`

其中最后一项只能作为弱信号，不能单独决定长期记忆晋升。

## 最小闭环

最小可行闭环应当是：

`run -> capture trace -> observe outcome -> attach feedback -> update memory state`

如果缺少 `observe outcome` 或 `attach feedback`，系统就无法区分：

- 只是被生成过的经验
- 与真正提升任务表现的经验

因此，记忆系统的核心不是“能写入多少经验”，而是“能为多少经验拿到可信反馈”。

## `feedback_object`（支持对象）

`feedback_object` 不是第五个核心对象，而是服务 `dynamic_memory` 的支持对象。

它回答的问题是：

`某次运行之后，我们拿到了什么反馈，它作用于哪个记忆对象，这个反馈有多可信？`

### 作用

- 让 `Episode / Learning / Behavior Delta / skill_pack update` 的判断有外部依据
- 把分散的反馈信号统一成可比较、可追溯的对象
- 为晋升、修正、降级、失效提供结构化输入

### 最小组成

- `feedback_id`
  - 反馈对象的唯一标识
- `target_ref`
  - 反馈作用的目标对象引用，例如某个 `Episode`、`Learning`、`Behavior Delta`
- `signal_type`
  - 反馈信号类型，例如 `explicit / implicit_behavior / environmental_outcome / review_trace`
- `source`
  - 反馈来源，例如用户、审阅者、下游工具链、测试系统、调度器
- `polarity`
  - 反馈方向，例如 `positive / negative / mixed / neutral`
- `strength`
  - 反馈强度，用于区分弱提示和强证据
- `rationale`
  - 对反馈含义的简要说明，回答“为什么这条反馈成立”
- `evidence_refs`
  - 指向 trace、测试结果、diff、评论、运行日志等证据
- `observed_at`
  - 反馈被观察到的时间
- `scope`
  - 反馈的适用范围，例如一次任务、某类任务、某个环境类别

### 边界

`feedback_object` 记录的是“反馈判断”，不是原始运行轨迹本身。

它应当引用证据，而不是复制整段 transcript、整份日志或整份工作区状态。

### 禁止混入

- 全量聊天记录
- 全量工具调用 trace
- 工作区脏状态快照
- 仅对某个特定后端实现有意义、无法迁移的私有字段

### 与记忆对象的关系

- `Episode`
  - 反馈判断这个案例是否值得进入长期链路
- `Learning`
  - 反馈判断这条经验是否真的提升后续决策
- `Behavior Delta`
  - 反馈判断这个行为变化是否值得保留或推广
- `skill_pack update`
  - 反馈判断某条行为规则是否已稳定到可以静态化

一个目标对象可以关联多个 `feedback_object`。

系统不应依赖单条反馈做最终判断，而应允许累计多条反馈后更新目标对象状态。

### 最小判断原则

对于 `feedback_object`，第一阶段只要求做到三件事：

1. 能区分反馈作用于谁
2. 能区分反馈是正向、负向还是混合
3. 能追溯反馈来自什么证据

在此基础上，后续再考虑复杂的加权、聚合和统计策略。

## 晋升规则

`dynamic_memory` 不应默认“只增不改”。不同层之间需要明确晋升门槛。

### `Episode -> Learning`

满足以下条件之一时，`Episode` 才应被提炼为 `Learning`：

- 多个独立 `Episode` 指向同一可复用判断
- 单个 `Episode` 具有高置信度且结果被外部验证
- 该经验已经在不同任务或环境中复现

即使满足以上条件，也仍需补全：

- `applicability`
- `failure_conditions`
- `evidence_refs`

如果这些信息缺失，说明它还只是案例，不是稳定经验。

### `Learning -> Behavior Delta`

满足以下条件时，`Learning` 才应晋升为 `Behavior Delta`：

- 该经验已经足够稳定，能转化为明确行为改变
- 该行为改变能被审阅，而不是模糊的“以后更注意”
- 预期收益大于潜在副作用

### `Behavior Delta -> skill_pack update`

满足以下条件时，`Behavior Delta` 才应升级为 `skill_pack`：

- 已经过审阅
- 已在多次运行中证明有效
- 不依赖单一工作区、单一项目或单一后端偶然条件

这一步本质上是“把经验升级为角色能力”，门槛必须最高。

## 失效规则

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

## 反思触发

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

## 范围限定

本项目当前只关注 `Agent 可外化、可迁移、可审阅的长期专属记忆`。

明确不纳入当前核心范围的包括：

- 上下文窗口中的工作记忆
- 模型参数内部的隐式记忆
- 通用知识库或项目知识库
- 纯运行时 scratchpad

这意味着本项目里的 `dynamic_memory`，默认是 Agent 专属的外挂长期记忆层，而不是对整个认知系统做全覆盖建模。

## 边界

`dynamic_memory` 是 Agent 的专属经验，不是工作区日志，也不是项目状态库，更不是通用知识库。

## 禁止混入

- 原始聊天全文
- 高频 scratchpad
- 工作区配置
- 项目待办
- 与 Agent 专业能力无关的杂项事实
