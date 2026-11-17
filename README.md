# Playbox

Playbox 是一个持续更新的浏览器小游戏收藏盒。每个游戏都能直接在电脑、手机或平板上打开，不需要安装客户端。

[**打开 Playbox**](https://BreadQiu.github.io/Playbox/) ·
[**直接玩 Blocky 24**](https://BreadQiu.github.io/Playbox/blocky-24/)

![Playbox 中的 Blocky 24](site/assets/blocky-24-preview.png)

## 游戏架上

### Blocky 24 · v0.2.0

黄色积木风的拖拽式 24 点游戏。把一张数字牌拖到另一张牌旁边的运算符上，用四则运算逐步合并，最后得到 24。

- 鼠标、触控和触控笔都使用同一套拖拽操作。
- 数字范围可选 `1–9` 或 `1–13`，并可在设置中允许出现无解题。
- 精确分数计算支持负数、除法与中间分数。
- 计时、撤销、重来、提示、有解检查和下一题状态完整联动。
- 默认使用“喜剧卡通”程序化音效，可在页面右上角静音。
- 添加 `?sound=tactile` 可试听“积木实体”音色，`?sound=comedy` 可显式选择默认音色。

详细改动见 [v0.2.0 发布说明](docs/releases/v0.2.0.md)。

更多不同类型的游戏会继续加入 `games/`。

## 本地运行

需要 Node.js 20 或更高版本。

```powershell
npm install
npm run dev
```

游戏开发地址是 `http://127.0.0.1:4173/`。

要查看完整的 Playbox 目录和子路径构建：

```powershell
npm run build
npm run preview
```

然后打开 `http://127.0.0.1:4176/`。

## 测试

```powershell
npm test -- --run
npm run test:e2e
npm run build
npm run verify:pages
```

浏览器测试默认使用本机 Microsoft Edge；在 CI 中使用 Playwright Chromium。

## 项目结构

```text
Playbox/
├── games/
│   └── blocky-24/       游戏源码、单元测试和浏览器测试
├── site/                Playbox 首页与预览素材
├── scripts/             统一构建、预览和 Pages 验证
├── docs/                设计与开发文档
└── .github/workflows/   GitHub Pages 部署
```

Playbox 首页是静态 HTML/CSS；Blocky 24 使用 Vite、TypeScript 和原生 DOM。音频由 Web Audio API 在首次用户操作后程序化生成，不依赖后端服务或第三方运行时接口。

## 发布

`main` 分支更新后，GitHub Actions 会运行单元测试、浏览器测试和生产构建，并将统一 `dist/` 发布到 GitHub Pages。正式版本通过仓库 Release 标记。

## 许可

[MIT](LICENSE) © 2026 Playbox contributors
