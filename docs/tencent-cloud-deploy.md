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
