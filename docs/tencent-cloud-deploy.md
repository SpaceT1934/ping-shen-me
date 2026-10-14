# 腾讯云测试部署

部署位置：`/home/ubuntu/ping-shen-me`，与服务器上其他项目分开。`current` 指向当前版本，`releases/` 放应用文件，`shared/data/apple` 保存 PGlite 数据，`shared/api.env` 保存服务配置，`runtime/` 放本项目专用 Node 22。更换版本时应保留 `shared/`。

- 页面入口：`http://211.159.160.11:8105/`（需要腾讯云入站 TCP 8105 放行）。
- API：Nginx 将同一入口下的 `/api/` 转给本机 `127.0.0.1:8106`，API 端口不对公网开放。
- 进程：`ping-shen-me-api.service`，由 systemd 管理。静态页面由 Nginx 的独立 `ping-shen-me-port` 站点提供，不使用现有域名。
- 页面素材使用 WebP；独立 Nginx 站点对脚本、样式和 JSON 开启 gzip。对应配置存放在 `infra/nginx/ping-shen-me.conf`。
- 数据：匿名会话和花园数据位于服务器的 `shared/data/apple`；本机开发数据没有迁移到测试服。GitHub 仓库只备份代码和素材，不备份服务端用户数据。

维护时在服务器上运行 `sudo systemctl status ping-shen-me-api.service`，检查 `curl http://127.0.0.1:8105/api/v1/health/ready`。修改 Nginx 配置后先运行 `sudo nginx -t`，再重新加载 Nginx。

该测试入口使用 HTTP。为使匿名会话能在 IP 加端口的地址下正常保存，服务配置将 `COOKIE_SECURE` 设为 `false`。这适合短期功能验收；有真实用户数据时应改用 HTTPS 及安全 Cookie，并完善账号与备份方案。

2026-10-13：腾讯云轻量应用服务器已放行入站 TCP 8105。Mac 与 NAS 从公网访问健康接口均返回 HTTP 200，浏览器打开了开始页并显示了图片资源。测试版入口现可使用。

## 从 GitHub 自动发布

`.github/workflows/deploy.yml` 仅在 `main` 分支收到提交时运行：安装锁定的依赖、执行 `pnpm check`，然后用专用 SSH 密钥传发布包到服务器。其他分支的提交不会触发发布。依赖锁文件、共享包 manifests 和 contracts/domain 编译结果共同参与依赖指纹；仅这些都未变化时复用服务器现有的生产依赖，否则传完整生产依赖，避免共享包规则仍运行旧版本。发布脚本位于 `infra/deploy/`，不打包 `.env`、`.data`、源码、测试文件或网页运行时不再使用的原始 PNG。

服务器上的专用公钥在 `ubuntu` 的 `authorized_keys` 中绑定到 `shared/receive-release.sh`，只接受 `deploy <40 位提交哈希>` 命令；密钥关闭交互终端、代理和端口转发。GitHub 仓库 Actions secrets 保存私钥 `DEPLOY_SSH_KEY` 与已核对的服务器公钥记录 `DEPLOY_KNOWN_HOSTS`。两者均不进入 Git 历史。更新接收脚本时，先人工审查，再同步到服务器的 `shared/receive-release.sh`。

每次发布落在独立的 `releases/<提交哈希>` 目录；切换 `current` 后重启本项目 API，并检查数据库、页面与图片是否可访问。检查失败时自动恢复上一版本并重启。`shared/data/apple` 与 `shared/api.env` 不属于发布包。数据库迁移可能改变数据结构，因此涉及不兼容迁移的提交应先设计向前兼容方案；代码回退不等于数据库回退。Nginx 配置位于仓库供审查，修改后仍需单独检查和部署，自动流程不改动服务器上的其他站点。
