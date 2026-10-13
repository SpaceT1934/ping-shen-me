# 像素风 UI 素材与生成记录

使用内置 image_gen 生图工具，以 PRD 中的示例图作为风格参考，分别生成独立背景和一张透明图标精灵图。正文、按钮、输入框和列表均为网页组件，图片中不包含界面文字。

## 最终素材

- `apps/web/public/assets/pixel/orchard.png`：首页、品牌页、成长和果实页面的果园背景，1024 × 1536。
- `apps/web/public/assets/pixel/room.png`：记录、种子引导和项目详情的暖光房间背景，1024 × 1536。
- `apps/web/public/assets/pixel/sprites-v2.png`：透明精灵图，1536 × 1024，四列两行，包含苹果角色、三色苹果、视频、书籍、公文包、日历。
- `sprites.png`：第一版图标素材，仅保留为生成过程参考；实际界面使用 v2。

基础导航与操作符号采用 SVG，颜色与尺寸可随交互状态变化。生成素材会接近参考的风格，但不是参考图逐像素的复制。

## 页面体验范围

`/` 首页；`/welcome` 品牌页；`/seed` 手动创建方向；`/projects` 项目列表；`/projects/:id` 项目详情；`/records` 文字记录与确认；`/growth` 成长反馈；`/fruit?project=:id` 果实；`/reports` 报告；`/settings` 个人页。

当前项目、记录、成长与成果由后端数据库持久化；旧版浏览器体验数据会一次性迁移并保留原缓存。身份使用独立匿名会话。AI 和语音识别未接入。完整手动规则见 `manual-v1.md`。

## 开始页与轻微动效

首次访问根路径会进入 `/welcome`。点击“看看我的树”或完成手动创建后，后端保存该会话用户的引导状态，此后根路径直接进入首页。

果园使用局部遮罩让叶簇轻微摆动，背景、树干、标题和操作按钮保持固定。小苹果分为身体与头顶叶子两层，分别呈现低幅度呼吸和缓慢摆动；少量飘叶采用错开的长周期，不持续占据视线。输入场景的植物同样只做轻微摆动。

环境动效在页面进入后台时暂停；系统设置 `prefers-reduced-motion: reduce` 时所有动画停用，飘叶隐藏。没有新增图片素材。

## 完整提示词

### orchard

Use case: stylized-concept. Create a production background asset for a mobile pixel-art life-growth app, inspired very closely by the orchard screens in the supplied PRD reference. Reference is style and composition only. Portrait 1024x1536. Rich cozy handcrafted 16-bit pixel art with clearly visible square pixels and crisp stepped edges, lush green and olive leaves, huge beautiful apple tree centered, broad branching brown trunk, blue sky with soft cream clouds, warm afternoon light, small flowers and grass, a wooden fence at the lower right. Tree crown spans the middle 35%-75% of the scene with four open spots on the branches for interactive apple sprites added in code. Top 25% is mostly blue sky for UI overlays. Bottom 20% grass clearing for mascot. No apples or fruit, no characters, no text, no letters, no UI, no phone frame, no watermark. Match the reference's charming pixel game environment rather than photorealism.

### room

Use case: stylized-concept. Create a production background asset for the cozy indoor seed-dialogue and project-detail screens of a mobile pixel-art app. Match the supplied PRD reference's sunlit potting room closely: wooden window on left, warm peach plaster walls, timber shelves, little terracotta pots with green plants along both sides, warm golden sunlight falling diagonally across wall and floor, rich pixel detail. Portrait 1024x1536, handmade 16-bit pixel art with crisp square pixels, stepped edges and warm brown outlines. Center area should be quiet open warm peach wall to support speech bubble overlay; bottom center a patch of soft soil on wooden floor for a separately rendered mascot. No characters, no text, no icons, no UI, no phone frame, no watermark.

### sprites

Use case: stylized-concept. Generate a single production UI sprite atlas, inspired closely by the supplied PRD pixel-art app. Actual transparent background, no ground, no checkerboard drawn. Landscape 1536x1024. Exactly 4 columns by 2 rows of equal cells, centers precisely evenly spaced. Each isolated sprite must fit within central 65% of its cell with generous transparent margins and no overlapping cells. Row 1 left to right: (1) cheerful round cream-white baby apple mascot with two green sprout leaves on head, tiny brown eyes and smile, peach pink cheeks, stubby arms and feet; (2) red/pink ripe apple with green leaf and bold stepped dark brown outline; (3) golden yellow apple with leaf same style; (4) green apple with leaf same style. Row 2 left to right: (1) green rounded film slate / video play icon; (2) blue open study book icon; (3) warm brown professional briefcase icon; (4) small beige pixel calendar with coral tabs. Coherent adorable detailed 16-bit pixel art, crisp visible square pixels, warm outlines, subtle highlights, exactly matching the charming PRD sprites. No text, no letters, no labels, no gridlines, no shadows outside sprites, no UI, no watermark.

### sprites v2 透明边缘修订

Use case: background-extraction. Edit this sprite atlas by removing EVERY colored glow, shadow, gradient and background haze around the eight icons. Preserve the eight icons themselves exactly, their pixel outlines, colors, positions, cell spacing, canvas dimensions and shapes. Pixels outside the actual solid icon silhouettes must have alpha exactly zero. Pixels inside the silhouettes including dark brown outlines must be opaque. No glow, no ambient shadow, no gray/black backgrounds or checkerboard. This is a production transparent sprite sheet for CSS compositing on bright backgrounds. Keep the 4 columns 2 rows arrangement. Genuine transparent background.
