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

## 数据准入标准

在继续细化 `feedback_object` 之前，必须先回答一个更基础的问题：

`什么数据有资格进入记忆判断链路？`

不是所有运行数据都值得进入 `dynamic_memory`。

如果某类数据只是“能采集”，但无法稳定关联经验使用和结果，最终只会把噪音包装成反馈。

### 四个必要条件

一类数据要想进入记忆判断链路，至少应同时满足以下四个条件：

#### 1. `observable`

Agent 在实际运行过程中能够稳定获取这类数据。

典型例子：

- 工具调用结果
- 测试与构建结果
- 用户接受、拒绝或修改产出的行为
- 运行 trace 中的关键决策节点

如果一类数据只能靠事后猜测或人工脑补得到，它就不适合作为默认反馈输入。

#### 2. `linkable`

这类数据必须能关联到：

- 某次运行
- 某个经验对象的使用
- 某个结果或后果

也就是说，它至少要能回答：

`这条经验在什么时候被用过，之后发生了什么？`

如果无法建立这种关联，数据再丰富也不能支持记忆判断。

#### 3. `evaluatable`

这类数据必须可以被独立评估其价值方向，而不是只能被动记录。

最少应能判断：

- 正向
- 负向
- 混合
- 不确定

如果一类数据既无法区分好坏，也无法判断强弱，它就不该直接驱动晋升或失效。

#### 4. `distillable`

这类数据必须最终能被压缩、提炼并挂接回记忆对象，而不是只能停留在原始日志层。

也就是说，它应能被转化为：

- `feedback_object`
- `Episode` 的证据
- `Learning` 的验证/修正输入
- `Behavior Delta` 的审阅依据

如果一类数据只能长期以原始日志形式堆积，它更适合作为审计材料，而不是记忆材料。

### 当前可接受的数据类型

按当前边界，优先接受以下几类数据进入记忆判断链路：

- `outcome events`
  - 测试通过、构建成功、任务闭环、工具执行成功或失败
- `usage events`
  - 某条经验被检索、被采用、被忽略、被人工改写
- `review events`
  - 用户纠正、审阅批注、人工标注、trace grading
- `trace anchors`
  - 能定位关键决策节点的结构化 trace 引用

### 当前不应直接进入记忆链路的数据

- 全量聊天 transcript
- 全量工具调用日志
- 工作区全量状态快照
- 无法证明与经验使用有关的点击流或噪音事件
- 只在单一后端内部可见、无法跨环境迁移的私有状态

### 核心判断

本项目后续设计的重点，不是“尽量多采集数据”，而是：

`只让满足 observable / linkable / evaluatable / distillable 四条件的数据进入记忆判断链路。`

这条规则优先于 `feedback_object` 的细节设计。

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
- `polarity`
  - 反馈方向，例如 `positive / negative / mixed / neutral`
- `evidence_refs`
  - 指向 trace、测试结果、diff、评论、运行日志等证据
- `observed_at`
  - 反馈被观察到的时间

以上字段是第一阶段必须保留的最小核心。

原因是它们分别对应了四条数据准入标准：

- `signal_type` / `observed_at`
  - 支撑 `observable`
- `target_ref`
  - 支撑 `linkable`
- `polarity`
  - 支撑 `evaluatable`
- `evidence_refs`
  - 支撑 `distillable`

### 可选扩展

以下字段暂不作为第一阶段必需字段，而是按需扩展：

- `source`
  - 在同一类反馈可能来自多个渠道时再显式建模
- `strength`
  - 在需要聚合多条反馈时再引入
- `rationale`
  - 在需要人工复核或解释时再引入
- `scope`
  - 在需要表达“只对某类环境成立”时再引入

将这些字段后置的原因很直接：

- 它们有价值，但不是所有运行环境都能稳定提供
- 过早把它们做成硬性字段，会让 `feedback_object` 再次膨胀
- 第一阶段更重要的是先证明最小闭环成立

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

在此基础上，后续再考虑：

- 来源区分
- 强度加权
- 范围限制
- 解释文本
- 统计聚合策略

## 规则挂接

从第一阶段开始，`feedback_object` 就应直接参与 `dynamic_memory` 的状态变化判断。

换句话说：

- 晋升不是只看“内容是否看起来合理”
- 失效不是只看“后来似乎不对了”
- 反思也不应只是自由回顾

这些动作都应尽量绑定到可追溯的 `feedback_object`。

## feedback aggregation

`feedback aggregation` 的作用不是做复杂评分，而是回答一个更基础的问题：

`当同一个目标对象关联了多条 feedback_object 时，系统如何形成阶段性判断？`

### 目标

- 把分散反馈整理成可用于状态变化的判断输入
- 避免单条偶然反馈直接驱动晋升或降级
- 保持规则开放，允许不同运行环境以后采用不同聚合策略

### 最小输入

- 指向同一目标对象的一组 `feedback_object`
- 这些反馈的：
  - `signal_type`
  - `polarity`
  - `observed_at`
  - `evidence_refs`

### 最小输出

第一阶段不要求输出数值分数，最少只需输出：

- `supporting`
  - 当前反馈整体更支持保留或晋升
- `conflicting`
  - 当前反馈存在明显冲突，不能直接推进状态变化
- `insufficient`
  - 当前反馈仍然不足，应该等待更多证据

### 聚合原则

- 不追求“精确打分”，先追求“方向判断”
- 环境结果型反馈通常优先于纯显式评价
- 多条弱反馈可以形成趋势，但不必在第一阶段强行数值化
- 一条高置信度负向反馈，应至少能阻止盲目晋升
- 冲突反馈不应被简单相互抵消，而应进入 `reflect`

### 非目标

当前阶段不定义：

- 固定权重
- 数值公式
- 后端绑定的统计实现
- 某一种唯一正确的聚合算法

也就是说，`feedback aggregation` 当前只是一个判断框架，不是评分系统。

## state transition threshold

`state transition threshold` 的作用是回答：

`什么情况下，一个对象的状态允许发生变化？`

这里的“阈值”不必先理解为数字，更合理的理解是：

`状态变化所需满足的最低证据条件`

### 目标

- 让晋升、修正、降级、删除有最低进入门槛
- 避免对象因为单次偶然反馈频繁抖动
- 保留不同场景下的阈值优化空间

### 第一阶段表达方式

第一阶段不冻结成数值阈值，而采用条件阈值表达：

- `ready`
  - 已具备推进状态变化的最低条件
- `hold`
  - 暂时保持当前状态，等待更多反馈
- `review`
  - 需要进入反思或人工审阅
- `block`
  - 当前明确不应推进该状态变化

### 阈值判断原则

- `Episode -> Learning`
  - 重点看是否已有足够证据证明该经验可复用
- `Learning -> Behavior Delta`
  - 重点看是否已有足够证据证明“行为改变后更好”
- `Behavior Delta -> skill_pack update`
  - 重点看是否已有跨实例、非偶然、可迁移的累计支持
- `keep / update / deprecate / delete`
  - 重点看当前反馈是否足以证明继续默认使用会带来风险或失真

### 与 aggregation 的关系

- `feedback aggregation` 负责形成阶段性反馈判断
- `state transition threshold` 负责决定该判断是否足以触发状态变化

换句话说：

- aggregation 解决“现在看到的反馈整体说明了什么”
- threshold 解决“这些说明是否已经足够让对象变状态”

### 非目标

当前阶段不定义：

- 每类对象的固定数值门槛
- 全局统一权重
- 一次性冻结的状态机参数

这些都应留给后续案例积累和实现验证后再优化。

## 晋升规则

`dynamic_memory` 不应默认“只增不改”。不同层之间需要明确晋升门槛。

### `Episode -> Learning`

满足以下条件之一时，`Episode` 才应被提炼为 `Learning`：

- 多个独立 `Episode` 指向同一可复用判断
- 单个 `Episode` 具有高置信度且结果被外部验证
- 该经验已经在不同任务或环境中复现

并且，至少应满足以下反馈条件之一：

- 存在指向该 `Episode` 的正向 `environmental_outcome` 反馈
- 存在多条指向相关 `Episode` 的正向 `usage / review` 反馈
- 存在可证明“该经验被使用后结果更好”的证据引用

如果完全没有 `feedback_object` 支撑，`Episode` 默认不应晋升为 `Learning`，除非它只是作为待验证候选被暂存。

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

并且，至少应有一组能支持行为改变的反馈对象：

- 正向 `environmental_outcome` 反馈
- 正向 `implicit_behavior` 反馈
- 正向 `review_trace` 反馈

如果只有结论，没有“行为改变后更好”的反馈证据，它仍应停留在 `Learning`。

### `Behavior Delta -> skill_pack update`

满足以下条件时，`Behavior Delta` 才应升级为 `skill_pack`：

- 已经过审阅
- 已在多次运行中证明有效
- 不依赖单一工作区、单一项目或单一后端偶然条件

并且，应满足更强的反馈门槛：

- 至少有来自多个运行实例的正向反馈对象
- 没有足以推翻它的持续负向反馈对象
- 反馈证据显示其效果不只局限于一次偶然成功

`skill_pack update` 的本质是静态化，所以它必须依赖累计反馈，而不能只依赖单次成功案例。

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

这些信号在第一阶段应尽量通过负向或混合 `feedback_object` 被显式记录，而不是只在事后口头判断。

最小挂接原则：

- `update`
  - 至少存在表明“主体仍成立但边界要修正”的混合反馈
- `deprecate`
  - 至少存在持续负向反馈，或存在明确显示“默认使用已不再合适”的反馈
- `delete`
  - 至少存在高置信度冲突反馈，或确认该对象越界、错误、不可迁移

如果还没有足够反馈，优先保持为 `keep` 或等待更多证据，而不是过早删除。

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

在第一阶段，`reflect` 的主要输入不应是全量历史，而应是：

- 新产生的 `feedback_object`
- 尚未解释的负向反馈
- 同一目标对象上的反馈冲突
- 达到晋升门槛但尚未审阅的对象

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
