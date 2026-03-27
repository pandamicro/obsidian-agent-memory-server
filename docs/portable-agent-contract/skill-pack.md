# skill_pack

## 作用

定义 Agent 的静态、可分发、可移植的专业能力包。

## 最小组成

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

## 边界

`skill_pack` 是静态资产，定义 Agent 应当如何工作，而不是记录它这次运行学到了什么。

## 禁止混入

- 原始案例堆积
- 临时结论
- 未审阅的行为调整
- 某个具体后端的专有命令或硬编码配置
