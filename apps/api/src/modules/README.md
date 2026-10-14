# 后端模块

session 处理匿名身份；health 处理存活与数据库就绪；garden 保留跨项目、任务、行动、成长和成果一致提交的聚合事务边界。

对外资源路由分别位于 project.routes.ts、record.routes.ts、task.routes.ts、goal.routes.ts、result.routes.ts、report.routes.ts。garden.routes.ts 组合资源路由并处理 bootstrap、session、引导和旧原型导入。http-utils.ts 处理通用分页、对象查找和幂等头；http-presenters.ts 负责 snake_case DTO、成长反馈与报告；resource.service.ts 组合领域规则和事务。

契约在 packages/contracts/src/http.ts。旧 garden/commands HTTP 入口已移除，内部命令仅用于领域层。SQL 与持久化幂等记录集中在 repositories；数据库结构与升级集中在 db/schema.ts、drizzle。

完整路径、请求、响应和扩展功能见 [接口约定 V0.2](../../../../docs/苹什么_前后端接口约定_V0.2.md)。
