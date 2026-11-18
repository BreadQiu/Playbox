# Changelog

Playbox 的正式版本改动记录。详细说明保存在 `docs/releases/`。

## [0.3.0] - 2026-11-18

### Changed

- 网站浏览器标题和页面品牌更新为 `Blocky 24`。
- 拖拽目标改为按幽灵卡与数字牌、运算符的实际重叠面积判断。
- 运算符改用固定命中框与独立可见圆泡，避免悬浮时产生第二个误导高亮。
- 提示优先选择结果非负的第一步，避免出现较小的数减较大的数。
- README 删除本地运行、测试、项目结构和发布板块。

### Verified

- 35 个单元测试通过。
- 50 个浏览器测试通过。
- 生产构建与 GitHub Pages 子路径验证通过。

详细说明：[Blocky 24 v0.3.0](docs/releases/v0.3.0.md)

## [0.2.0] - 2026-11-18

### Changed

- Blocky 24 默认使用“喜剧卡通”程序化音效，从 Playbox 首页或游戏地址直接进入时不再回退到积木音色。
- 保留 `?sound=tactile` 作为“积木实体”音色的显式试听入口。
- Playbox 首页和 README 的版本标记更新为 `v0.2.0`。

### Verified

- 34 个单元测试通过。
- 47 个浏览器测试通过。
- 生产构建与 GitHub Pages 子路径验证通过。

详细说明：[Playbox v0.2.0 — 默认喜剧卡通音效](docs/releases/v0.2.0.md)

## [0.1.0] - 2026-11-18

Playbox 首个公开版本，包含游戏目录与首款游戏 Blocky 24。

详细说明：[Playbox v0.1.0 — Blocky 24](docs/releases/v0.1.0.md)
