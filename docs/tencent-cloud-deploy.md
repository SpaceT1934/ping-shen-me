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

`.github/workflows/deploy.yml` 仅在 `main` 分支收到提交时运行：安装锁定的依赖、执行 `pnpm check` 和 Python 模拟测试，然后用专用 SSH 密钥传发布包到服务器。测试不会调用真实模型。其他分支的提交不会触发发布。依赖锁文件、共享包 manifests 和 contracts/domain 编译结果共同参与依赖指纹；仅这些都未变化时复用服务器现有的生产依赖，否则传完整生产依赖，避免共享包规则仍运行旧版本。发布脚本位于 `infra/deploy/`，打包 Node 编译产物、网页、Python AI 运行源码与依赖清单，不打包真实 `.env`、`.data`、测试文件或网页运行时不再使用的原始 PNG。

服务器上的专用公钥在 `ubuntu` 的 `authorized_keys` 中绑定到 `shared/receive-release.sh`，只接受 `check-deps <64 位依赖指纹>` 或 `deploy <40 位提交哈希> <full|reuse> <64 位依赖指纹>` 命令；密钥关闭交互终端、代理和端口转发。GitHub 仓库 Actions secrets 保存私钥 `DEPLOY_SSH_KEY` 与已核对的服务器公钥记录 `DEPLOY_KNOWN_HOSTS`。两者均不进入 Git 历史。首次配置 AI 需要服务器控制台或管理员登录，专用发布密钥不能执行任意配置命令。

每次发布落在独立的 `releases/<提交哈希>` 目录；切换 `current` 后重启本项目 API，并检查数据库、页面与图片是否可访问。检查失败时自动恢复上一版本并重启。`shared/data/apple` 与 `shared/api.env` 不属于发布包。数据库迁移可能改变数据结构，因此涉及不兼容迁移的提交应先设计向前兼容方案；代码回退不等于数据库回退。Nginx 配置位于仓库供审查，修改后仍需单独检查和部署，自动流程不改动服务器上的其他站点。

## 首次启用 Python AI（服务器管理员操作一次）

先将本版提交到 main 并等待第一次发布成功。此时网页和业务后端已更新，但 Python 未配置前 AI 入口显示不可用，手动业务可以继续使用。发布包会包含下列脚本。

在腾讯云服务器控制台，以现有 `ubuntu` 用户运行：

```bash
# 需要 Python 3.10+；Ubuntu 缺少 venv 时先安装 python3-venv。
python3 --version
sudo apt-get update
sudo apt-get install -y python3-venv
bash /home/ubuntu/ping-shen-me/current/infra/deploy/setup-ai.sh
```

首次运行会创建权限为 600 的 `/home/ubuntu/ping-shen-me/shared/ai.env`，提示填写配置并退出。随后只在服务器本地编辑它：

```bash
nano /home/ubuntu/ping-shen-me/shared/ai.env
```

填写 `DASHSCOPE_API_KEY`、该业务空间的 `LLM_BASE_URL` 和 `LLM_MODEL=qwen3.8-flash`。语音填写 `ASR_MODEL=qwen-audio-3.1-asr-flash`，确认此账号仍有免费额度且已开启用完即停后设置 `ASR_ENABLED=true`。内部 `AI_SERVICE_TOKEN` 已随机生成，脚本会同步给 Node，不需要手工复制。环境文件不要发到群聊或提交 GitHub。

再次执行：

```bash
bash /home/ubuntu/ping-shen-me/current/infra/deploy/setup-ai.sh
```

脚本检查配置、建立按依赖指纹隔离的虚拟环境、安装 `ping-shen-me-ai.service`（仅监听 `127.0.0.1:8002`），同步 Node 内部认证并重启服务。就绪检查通过后才启用新的发布接收脚本和 `shared/.ai-enabled` 标记。失败时恢复此前环境配置并重启原服务。首次启用成功后，main 的后续发布会一起更新 Python 和 Node；AI 启动或就绪失败也触发代码回退。

发布使用 `sudo -n systemctl restart`。若服务器 sudoers 仅授权了 API 服务，管理员还需通过 `sudo visudo` 为该发布用户增加 **仅重启 `ping-shen-me-ai.service`** 的权限；不要开放任意 sudo 命令。setup 会用同一非交互重启命令检查权限，失败时不启用自动 AI 发布。

仓库 Nginx 配置新增了 `client_max_body_size 7m`，自动发布不会替换服务器站点配置。请在当前实际站点中补上这一行，再运行 `sudo nginx -t && sudo systemctl reload nginx`；保留同学正在配置的域名与 HTTPS 配置。

验收不消耗模型额度：

```bash
sudo systemctl status ping-shen-me-ai.service --no-pager
curl -fsS http://127.0.0.1:8105/api/v1/health/ready
```

成功响应的 `data` 应含 `database:"connected"` 和 `ai_service:"connected"`。这确认服务进程、内部认证及模型配置已就绪；不代表真实供应商调用已成功，需要最后各做一次简短文字分析和音频转写。查看错误时使用 `journalctl -u ping-shen-me-ai.service -n 50 --no-pager`，分享日志前检查有无敏感信息。

## 队友访问与网页录音

部署完成后分享现有页面入口即可，不依赖开发者电脑继续开机。当前 HTTP 地址可体验文字和音频文件上传。公网浏览器直接使用麦克风需要 HTTPS；待同学配置域名与证书后，更新业务服务的 `CORS_ORIGIN` 和 `COOKIE_SECURE=true` 并重启。HTTPS 站点应继续将 `/api/` 转到本机 API，Python 端口始终保持不对公网开放。Nginx 同时设 `client_max_body_size 7m`，确保 5 MB 音频经 base64 编码后能正常上传。
