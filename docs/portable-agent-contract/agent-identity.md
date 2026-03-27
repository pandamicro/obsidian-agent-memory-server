# agent_identity

## 作用

定义 Agent 的连续性与唯一性，回答“这是不是同一个 Agent”。

## 最小组成

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

## 边界

`agent_identity` 只定义身份，不定义技能细节，不保存动态经验，也不承载运行环境状态。

## 禁止混入

- 工作区路径
- 项目状态
- 临时任务上下文
- 后端配置
- 运行时学到的临时经验
