# 水彩手帐 UI 素材与场景

更新：2026-10-17。当前 UI 使用「移动端参考图.zip」以及同日拆出的「苹什么_新移动端_Figma与独立素材」素材包，替换此前的像素风。原始切片、透明重建、独立背景和 SVG 操作图标均已归入运行时素材库；页面按业务需要组合使用，不把参考图中的文字、手机边框或示例数据烘焙进界面。

## 工程位置

- `apps/web/public/assets/journal/`：优化后的 WebP、23 个 SVG 操作图标、字体及授权。
- `manifest.json`：素材来源清单；相同名称优先使用透明重建版。
- `apps/web/src/components/Illustration.tsx`：插画、角色和操作图标统一入口，保留已有项目的图标键兼容性。
- `apps/web/src/components/GardenVisuals.tsx`：四阶段树、五档成熟度苹果、真实收获数果篮。
- `apps/web/src/components/AmbientScene.tsx`：轻微角色呼吸与星光动效。
- `apps/web/src/styles/journal.css`：水彩、奶油纸张、手写字体、珊瑚按钮和场景排版。
- `apps/web/src/lib/garden/activity-chart.ts`：按报告区间和真实行动时间生成图表，不补造统计数据。

字体使用 Google Fonts 的 Ma Shan Zheng，按原字库完整生成 WOFF2 分片。基础片包含前端、后端、领域规则中的文案及常用符号；其余字形通过 `unicode-range` 按需下载，避免用户输入或 AI 内容因为旧版子集缺字而混入系统字体。所有分片本地托管，文件名带内容指纹，更新后不会误用旧缓存。字库外的罕见字保留系统楷体/中文字体回退。授权保留在 `FONT-LICENSE.txt`。

`apps/web/src/styles/journal-fonts.css` 为生成的字形范围；`journal.css` 的 `--font-journal` 是统一字体入口。标题、正文、按钮、表单、占位文字和统计数字统一使用原生 400 字重，避免只有单一字重的手写字体混用旧版粗体。

重新生成：安装开发用 `fonttools[woff]`，取得 OFL 授权的原始 `MaShanZheng-Regular.ttf` 后运行 `python apps/web/scripts/build-journal-font.py /path/to/MaShanZheng-Regular.ttf`。分组提示保存在 `journal-font-groups.json`，构建验证原字库覆盖和分片范围不重叠；生成后运行 `pnpm exec prettier --write apps/web/src/styles/journal-fonts.css`。生产运行和 CI 不依赖 Python 字体工具。

## 场景对应

| 页面           | 参考构图与实现                                                   |
| -------------- | ---------------------------------------------------------------- |
| 欢迎           | 天空、云朵、花草背景；标题、粉色对话、红苹果角色、木牌与珊瑚按钮 |
| 我的树林       | 共享草地，各项目独立小树、木牌、目标苹果、进度便签及果篮         |
| 创建、记录     | 草地角色对话头部，下方奶油纸张表单、语音及确认操作               |
| 项目列表、详情 | 纸张卡片、树木插画、四阶段图鉴、多目标及行动历史                 |
| 成长反馈       | 角色与对话气泡、行动统计、浇水项目列表                           |
| 成熟、收获     | 草地、项目对应阶段的树、真实成熟果实、接果角色与果篮             |
| 报告、我的     | 统一纸张、手绘图标；行动柱状图和累计折线由后端统计区间与记录生成 |

项目是树、目标是苹果。树按手动收获数升级；树上苹果按各目标的确认进度显示。原图树上固定的装饰苹果不参与实时数据渲染，避免与真实目标数量冲突。果篮图示表示空/非空，旁边数字为真实收获数。

参考图中的问卷、提醒、分享海报及其他超出 PRD V1.1 的功能没有因此新增。实际导航、文字、表单和数据仍为网页组件。旧 `assets/pixel/orchard.webp` 暂保留兼容现有部署健康检查，界面不再引用。

## 同风格补充资产

使用内置 image_gen 编辑原素材，补出以下五张透明 PNG，随后裁切透明留白、优化为 WebP。原 PNG 保存在本地 `design-export/journal-supplement/`，不随应用发布。

| 运行时文件              | 原始 PNG               | 用途                                   |
| ----------------------- | ---------------------- | -------------------------------------- |
| `tree-bare.webp`        | `tree-bare.png`        | 去掉固定装饰果实，动态叠加实际目标苹果 |
| `tree-sprout.webp`      | `tree-sprout.png`      | 独立透明两叶小树苗                     |
| `basket-empty.webp`     | `basket-empty.png`     | 空果篮，按真实收获状态显示苹果         |
| `goal-fruit-green.webp` | `goal-fruit-green.png` | 独立透明青苹果与成熟度变化             |
| `goal-fruit-red.webp`   | `goal-fruit-red.png`   | 独立透明红苹果、成熟与摘果动画         |

所有补充素材都从这套参考图编辑，保持水彩质感、暖棕描边及原始造型。角色采用已拆出的 welcome、wink、cheer、feedback、harvest 等透明姿态。

## 完整生成提示词

### tree-bare

Use case: precise-object-edit. Production transparent UI asset for the SAME hand-painted journal app. Edit target: supplied tree. Remove ONLY the two green/yellow apple fruits and reconstruct the matching turquoise/lime watercolor leaf canopy behind them. Preserve exactly the existing tree silhouette, branches, brown trunk, warm dark-brown hand-drawn outline, watercolor texture and white sticker edge. Entire tree fully visible, closely cropped with small safe transparent margins. Genuine transparent alpha background. NO fruit, NO text, NO ground, NO extra objects. Do not redesign or change style.

### basket-empty

Use case: precise-object-edit. Edit the supplied warm hand-painted wicker fruit basket for this exact journal app. Keep the same oval wicker basket shape, woven tan/orange texture and warm dark-brown hand-drawn outline. Remove ALL apples, leaves, sparkles, ground and background, leaving an EMPTY basket with visible empty interior. Reconstruct hidden rim carefully. Full basket closely framed with small transparent margins, genuinely transparent alpha background. Same cheerful watercolor illustration style, NO text, no shadows outside basket.

### tree-sprout

Use case: background-extraction. Edit target is this tiny hand-painted green sprout in a small tan soil patch. Isolate the COMPLETE sprout including two green leaves, stem and its own small soil patch. Remove surrounding forest/grass/background. Preserve original shape, dark warm brown outline and watercolor texture, closely matching the provided reference. High quality transparent alpha asset with small safe margins, no new elements, no letters, no frame.

### goal-fruit-green

Use case: background-extraction. Production standalone UI green apple from the supplied cutout. Preserve exactly this squat green apple shape, brown curved stem, green leaf, dark green hand-drawn outline and pale highlights, same watercolor journal illustration. Remove all cream/green background and other surrounding elements. Reconstruct a clean full isolated apple, large enough for UI, close framing and small safe transparent margins. Genuine transparent alpha. No text, no ground, no mascot face, no additional fruit.

### goal-fruit-red

Use case: background-extraction. First image is edit target: isolate its red apple alone. Second image is supporting reference for apple proportions/style consistency. Preserve the warm coral-red apple, brown stem, green leaf, dark hand-drawn outline, white highlight and watercolor texture. Remove all background and orange emphasis strokes. Full isolated red apple closely framed with small transparent margins. Genuine transparent alpha. No text, no ground, no face, no extra fruit. Match the existing hand-painted journal UI illustration.

## 动效与加载

角色低幅度呼吸、星光缓慢明暗、摘果后落入果篮。所有动效尊重 `prefers-reduced-motion`，后台暂停环境动效。背景 WebP、独立插画及本地字体共享浏览器缓存；不在页面间下载整张截图。

## 2026-10-18：psm_21.fig

当前页面以新版 psm_21.fig 为准。新素材集中在 `apps/web/public/assets/figma21`；manifest 记录每个可见素材的 Figma 节点、原图哈希、原始尺寸和运行尺寸。69 个可见位图包含 @4x 替换层和独立浇水角色，导航使用该文件导出的矢量图标。被 Figma 隐藏的旧位图不再作为实现来源，旧 journal 位图和操作图标目录已经移出运行资产；journal/fonts 保留。

背景约 173/204 KiB，全部新位图合计约 1.4 MiB，不在浏览器加载原始 PNG。动效来自 Figma 的欢迎页 MCP 输出和本地逐节点时间线；参数与界面绑定分离，不使用整页截图作为页面。
