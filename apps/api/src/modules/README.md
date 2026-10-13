# 后端模块

`session` 处理匿名身份，`garden` 处理手动命令与报告，`health` 处理基础就绪检查。路由只校验参数、解析会话和调用应用服务；规则集中在 `packages/domain`，SQL 集中在 `repositories`。

Garden 是当前手动业务的聚合事务边界：项目、目标、任务、记录、成长、成果必须一致提交。暂不拆成互相调用的独立服务，以免跨模块部分成功。后续实体数量变大时，可在该事务边界内部增加专用仓库和查询投影。

| 接口                           | 用途                   |
| ------------------------------ | ---------------------- |
| POST /api/v1/session           | 创建或复用匿名会话     |
| GET /api/v1/garden             | 读取当前用户花园       |
| POST /api/v1/garden/commands   | 校验并原子执行手动命令 |
| GET /api/v1/reports?period=7天 | 读取真实周期统计       |
| GET /api/v1/health             | 服务存活               |
| GET /api/v1/health/ready       | 数据库连通性           |

契约定义在 `packages/contracts/src/garden.ts`。命令类型包括项目创建与修改、状态更新、目标创建与进度、任务管理、手动批量记录、记录纠错与删除、成果收获、首次引导及旧原型迁移。
