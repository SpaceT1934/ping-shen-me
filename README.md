# 苹什么 Web App

手机优先的成长管理应用。项目、目标、任务、行动、灵感、成长与成果通过独立后端保存到数据库。现已接入 Python AI 服务，支持方向提取、记录分类、语音转写和可编辑草稿确认；语音模型采用 `qwen-audio-3.1-asr-flash`，需在配置中启用。

支持首次引导、项目创建与编辑、归档和恢复、三种目标模式、任务日期与完成撤销、目标建议、批量手动记录及纠错、成长阶段、成果历史与收获选择、周期报告和记录导出。已有浏览器原型数据会一次性迁移，原始缓存保留。

## 技术栈

| 层       | 选择                                     | 用途                                              |
| -------- | ---------------------------------------- | ------------------------------------------------- |
| 前端     | React、TypeScript、Vite、React Router    | 手机优先的像素风页面                              |
| 数据访问 | TanStack Query、Zod                      | 请求状态、缓存、响应校验与错误处理                |
| 后端     | Node.js、Fastify、TypeScript             | 独立 HTTP API 与会话                              |
| 数据库   | PostgreSQL、Drizzle 迁移                 | 事务持久化；开发默认使用 PGlite 嵌入式 PostgreSQL |
| 业务规则 | packages/domain                          | 目标、成长、成果、报告等可独立测试的规则          |
| 工程     | pnpm workspace、Vitest、ESLint、Prettier | 构建和检查                                        |

## 目录

```text
apps/web/src/
  app/                    路由、布局、服务端状态 Provider
  features/               页面与业务组件
    projects/components/  目标、任务、记录、成果和设置组件
  components/             通用展示组件与环境动效
  lib/garden/             REST 数据访问、幂等重试、旧缓存迁移、页面视图映射
apps/api/src/
  modules/ai/             当前会话的 AI 调用桥接
  modules/session/        匿名会话
  modules/garden/         路由与应用服务
  modules/health/         存活和数据库就绪检查
  repositories/           数据访问接口与 PostgreSQL/PGlite 实现
  db/                     Drizzle 模型与迁移入口
packages/contracts/       共享数据结构、输入和响应校验
apps/ai/                  Python AI 服务（只生成候选结果，不存业务数据）
packages/domain/          不依赖 React、Fastify 或数据库的业务规则
infra/                    本地数据库、Nginx 与发布脚本
.github/workflows/         main 分支检查与自动发布
docs/                     架构、业务规则与素材说明
```

## 本地启动

要求 Node.js 20.19+，建议 22.12+；使用根目录指定的 pnpm 版本。

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

默认无需 Docker。API 启动时自动执行迁移，PGlite 数据保存在 `apps/api/.data/apple`，该目录已忽略，不应加入版本管理。

- 前端：http://localhost:5173
- API 存活检查：http://localhost:3001/api/v1/health
- 数据库就绪检查：http://localhost:3001/api/v1/health/ready

首次进入为开始页；完成创建或选择查看树后，再次打开进入首页。初次访问会创建独立匿名会话，Cookie 为 HttpOnly；不同会话的数据由后端隔离。

### 切换到独立 PostgreSQL

在后端环境中设置 `DATA_DRIVER=postgres` 和 `DATABASE_URL`。本地可通过 `pnpm db:up` 启动 Compose 数据库。修改模型后运行 `pnpm db:generate`，审查 SQL；API 下次启动会自动执行迁移，也可在 API 停止时运行 `pnpm db:migrate`。

PGlite 是单进程开发数据库，运行中的 API 与迁移命令不要同时打开同一数据目录。生产环境默认采用独立 PostgreSQL，多实例不能共享 PGlite 文件。切换数据库驱动不会自动搬运已有数据。

### 检查与构建

```sh
pnpm check
pnpm build
pnpm --filter @apple/api start
pnpm --filter @apple/web preview
```

检查包括类型、代码规范、格式、业务规则、HTTP/数据库集成测试及生产构建。测试使用内存或临时目录数据库，不读写实际开发数据。

## 部署与当前边界

前端静态文件与后端服务分别部署。推荐同域反向代理 `/api/v1`，其他页面回退到 `index.html`。分域时，前端构建配置 `VITE_API_BASE_URL`，后端配置准确的 `CORS_ORIGIN`，并确保会话 Cookie 与 HTTPS 部署方式匹配。`vite preview` 只用于本地检查。

正式生产环境设置 `NODE_ENV=production`、`DATA_DRIVER=postgres`、`DATABASE_URL`；容器服务可设置 `HOST=0.0.0.0`。正式入口使用 HTTPS 和安全 Cookie。腾讯云 IP 加端口的 HTTP 测试部署单独设置 `DATA_DRIVER=pglite` 和 `COOKIE_SECURE=false`，详见部署记录。

当前使用匿名会话，尚未接入手机号、短信、第三方登录和跨设备账号恢复。会话保留 180 天；清除 Cookie 会打开新花园，服务端历史数据仍保留。记录可导出为 JSON 备份，暂不提供备份重新导入界面。成长阶段阈值采用暂定规则，详见业务说明。

- [接口约定 V0.2（实现版）](docs/苹什么_前后端接口约定_V0.2.md)
- [架构说明](docs/architecture.md)
- [手动业务规则](docs/manual-v1.md)
- [UI 素材与生成提示词](docs/ui-assets.md)
- [腾讯云测试部署](docs/tencent-cloud-deploy.md)

## AI 接入

新增的 Python AI 服务、网页确认流程、启动方式和分工见 [AI接入说明](./AI接入说明.md)。本地语音已完成实际录音验证；新环境默认关闭，确认额度和“用完即停”后再启用。

部署沿用 GitHub main 自动发布到腾讯云的流程。首次启用 Python 的服务器步骤见 [腾讯云部署说明](docs/tencent-cloud-deploy.md)。
