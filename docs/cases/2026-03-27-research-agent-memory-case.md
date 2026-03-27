# 2026-03-27 Research Agent Memory Case

本文档将本次关于 `obsidian-agent-memory-server` 的连续研究会话，模拟为一个研究型 Agent 的记忆提取案例。

目标不是复述全部对话，而是回答四个问题：

1. 哪些 `Episode` 值得留下
2. 哪些 `feedback_object` 可以挂接
3. 哪些 `Learning` 候选已经出现
4. 哪些内容仍不足以进入长期行为层

## 适用边界

- 本案例只模拟 `Agent 专属记忆`
- 不记录工作区通用状态
- 不记录项目管理杂项
- 不把原始 transcript 当作记忆本体

## 提炼标准

本案例沿用当前项目已确定的标准：

- `Episode` 需要有情境、动作、结果
- `feedback_object` 需要满足 `observable / linkable / evaluatable / distillable`
- `Learning` 需要能表达可复用判断，而不只是案例摘要
- `Behavior Delta` 需要更强的累计反馈支持，当前案例多数还只到 `Learning` 候选

## Episode Candidates

### E-01 收紧项目边界

- `situation`
  - 项目最初目标过宽，混入了 workspace/project/general knowledge memory 的需求
- `action`
  - 将项目边界收紧到 `Agent 专属技能` 与 `Agent 专属记忆`
- `outcome`
  - 后续研究主线明显更稳定，文档与判断不再持续发散
- `why_keep`
  - 这是复杂研究里高价值的边界收敛经验

### E-02 识别 Portable Agent Contract 为主问题

- `situation`
  - 需求复杂，容易直接滑向存储、架构或适配实现讨论
- `action`
  - 回到第一性原则，确认初始阶段唯一关键问题是 `Portable Agent Contract`
- `outcome`
  - 用户明确认可，后续多轮研究围绕同一主线展开
- `why_keep`
  - 这是研究型 Agent 处理复杂系统时的重要问题收敛经验

### E-03 从 memory 单点失焦中被纠偏

- `situation`
  - 讨论一度偏向 `dynamic_memory`，弱化了四对象框架
- `action`
  - 根据用户负反馈，把 `agent_identity / skill_pack / dynamic_memory / adapter_contract` 拉回同一框架
- `outcome`
  - 研究结构恢复平衡
- `why_keep`
  - 用户纠偏驱动框架修正，是可复用的研究行为经验

### E-04 修正适配层归属

- `situation`
  - 早期使用了 `runtime_adapter` 表述，容易把实现层误塞进 Agent 本体
- `action`
  - 改写为 `adapter_contract` 属于 Agent，本体只声明能力要求；具体 adapter implementation 属于环境
- `outcome`
  - 对象边界更清晰
- `why_keep`
  - 这是“契约 vs 实现”分离的典型建模经验

### E-05 通过真实浏览器上下文读取知乎文章

- `situation`
  - 直接自动化读取知乎页面被反爬拦截
- `action`
  - 复用用户已登录的 Chrome 上下文，启动可调试副本并提取文章结构
- `outcome`
  - 成功获取文章正文与章节结构，并补充进研究判断
- `why_keep`
  - 这是受限网页场景下的有效研究操作经验

### E-06 将反馈机制前置

- `situation`
  - 先定义了晋升与失效规则，但用户指出缺少反馈机制
- `action`
  - 将环境结果、使用行为、显式评价与 trace review 前置为反馈源
- `outcome`
  - 记忆系统从理论演化转向真实使用闭环
- `why_keep`
  - 这是 Agent memory 研究中的关键转折点

### E-07 先定义数据准入，再定义 feedback_object

- `situation`
  - 已开始细化 `feedback_object`
- `action`
  - 回退一步，先定义数据准入标准：`observable / linkable / evaluatable / distillable`
- `outcome`
  - `feedback_object` 被收缩为更稳的最小模型
- `why_keep`
  - 这是“先约束数据，再定义对象”的高价值经验

### E-08 拆分 Portable Agent Contract 文档

- `situation`
  - `portable-agent-contract.md` 持续膨胀，影响维护
- `action`
  - 拆成稳定主入口 + 对象子文档
- `outcome`
  - 主入口稳定，细节下沉，后续结构更清晰
- `why_keep`
  - 这是长期研究文档治理经验

## Feedback Candidates

### F-01 对主问题识别的显式正反馈

- `target_ref`
  - `E-02`
- `signal_type`
  - `explicit`
- `polarity`
  - `positive`
- `evidence_refs`
  - 用户明确认可“Portable Agent Contract 是初始阶段主问题”
- `observed_at`
  - 本次会话中段

### F-02 对失焦的显式负反馈

- `target_ref`
  - `E-03` 之前的失焦状态
- `signal_type`
  - `explicit`
- `polarity`
  - `negative`
- `evidence_refs`
  - 用户指出“不要因此失焦”
- `observed_at`
  - 本次会话中段

### F-03 对适配层归属修正的混合反馈

- `target_ref`
  - `E-04`
- `signal_type`
  - `explicit`
- `polarity`
  - `mixed`
- `evidence_refs`
  - 用户质疑 `runtime_adapter` 看起来是共享层，不应归属于 Agent 本体
- `observed_at`
  - 本次会话中段

### F-04 对浏览器复用策略的环境结果正反馈

- `target_ref`
  - `E-05`
- `signal_type`
  - `environmental_outcome`
- `polarity`
  - `positive`
- `evidence_refs`
  - 知乎正文成功读取，文章结构被提取并用于研究
- `observed_at`
  - 本次会话后段

### F-05 对反馈机制前置路线的行为正反馈

- `target_ref`
  - `E-06`
- `signal_type`
  - `implicit_behavior`
- `polarity`
  - `positive`
- `evidence_refs`
  - 用户继续沿反馈机制方向推进，而不是要求回到纯理论晋升规则
- `observed_at`
  - 本次会话后段

### F-06 对数据准入前置路线的行为正反馈

- `target_ref`
  - `E-07`
- `signal_type`
  - `implicit_behavior`
- `polarity`
  - `positive`
- `evidence_refs`
  - 用户继续要求基于数据准入标准收缩 `feedback_object`
- `observed_at`
  - 本次会话后段

### F-07 对文档拆分策略的环境结果正反馈

- `target_ref`
  - `E-08`
- `signal_type`
  - `environmental_outcome`
- `polarity`
  - `positive`
- `evidence_refs`
  - 文档拆分后结构稳定，主入口路径保持不变，引用未断
- `observed_at`
  - 本次会话后段

## Learning Candidates

### L-01 复杂系统研究先收敛本体边界

- `from`
  - `E-01`, `E-02`, `F-01`
- `claim`
  - 面对复杂需求，先识别本体边界与最小契约，比先讨论存储、接口或架构更有效
- `applicability`
  - 复杂产品研究、概念建模、长期系统设计
- `failure_conditions`
  - 用户明确只要快速实现草案时

### L-02 用户纠偏是高价值负反馈

- `from`
  - `E-03`, `F-02`
- `claim`
  - 当用户指出“失焦”时，应优先修正问题框架，而不是继续深化当前分支
- `applicability`
  - 研究型协作、需求澄清、多轮方案演化
- `failure_conditions`
  - 用户只是补充信息而不是纠偏时

### L-03 概念设计优先分离契约与实现

- `from`
  - `E-04`, `F-03`
- `claim`
  - 在 Agent 系统建模中，应优先分离 contract 与 implementation，否则环境层会污染本体
- `applicability`
  - 适配层设计、接口建模、跨环境抽象
- `failure_conditions`
  - 纯实现层讨论

### L-04 受限网页优先复用现有用户态上下文

- `from`
  - `E-05`, `F-04`
- `claim`
  - 自动化访问被拦截时，优先复用用户已有浏览器上下文，而不是继续硬抓
- `applicability`
  - 浏览器辅助研究、受限页面读取
- `failure_conditions`
  - 无合法用户上下文或存在权限边界时

### L-05 记忆规则必须依赖真实反馈

- `from`
  - `E-06`, `F-05`
- `claim`
  - 经验是否有帮助，默认应优先看环境结果和使用行为，而不是 Agent 自我解释
- `applicability`
  - Agent memory、评估系统、反馈驱动学习
- `failure_conditions`
  - 纯离线理论推演阶段

### L-06 先定义数据准入，再定义反馈对象

- `from`
  - `E-07`, `F-06`
- `claim`
  - 如果不先定义数据准入标准，反馈对象会迅速膨胀并退化成日志包装层
- `applicability`
  - observability -> memory 的设计链路
- `failure_conditions`
  - 上游已有成熟、强约束的数据模型时

### L-07 长期研究文档要保持主入口稳定、细节下沉

- `from`
  - `E-08`, `F-07`
- `claim`
  - 文档持续增长时，应保留稳定主入口，把细节下沉到对象子文档
- `applicability`
  - 长期研究仓库、规范文档演化
- `failure_conditions`
  - 非常小且生命周期短的单主题文档

## Behavior Delta Candidates

当前案例里，以下内容接近 `Behavior Delta` 候选，但反馈仍不足以直接静态化：

### BD-01 研究型 Agent 默认先做边界收敛

- `based_on`
  - `L-01`
- `proposed_change`
  - 遇到复杂愿景型需求时，默认先产出“主问题 + 边界排除项”，再继续分解
- `why_not_promoted_yet`
  - 目前主要来自单次高质量会话，还缺少跨任务累计反馈

### BD-02 反馈优先于自我解释

- `based_on`
  - `L-05`
- `proposed_change`
  - 设计任何记忆晋升或失效规则时，默认先追问反馈来源，而不是先做理论推导
- `why_not_promoted_yet`
  - 目前已被本次会话强支持，但还缺少更多异构任务验证

## 不应进入长期记忆的内容

以下内容更适合作为 trace 或审计材料，而不应直接进入 Agent 长期记忆：

- 具体 commit hash
- 单次 shell 命令细节
- 临时文件路径
- 某篇文章的页面抓取步骤细节
- Vault 当前目录结构中的偶然细节

## Case 结论

本案例说明，研究型 Agent 在真实多轮协作中，已经可以稳定沉淀三类对象：

- 高质量 `Episode`
- 可挂接的 `feedback_object`
- 可复用的 `Learning`

但要进入 `Behavior Delta` 甚至 `skill_pack update`，仍然需要更长时间跨度和跨任务累计反馈。
