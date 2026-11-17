# Blocky 24

Playbox 的第一款游戏：拖动数字牌并使用四则运算拼出 24。

[在线游玩](https://BreadQiu.github.io/Playbox/blocky-24/)

## 本地开发

从 Playbox 仓库根目录运行：

```powershell
npm install
npm run dev
```

## 测试

```powershell
npm test --workspace @playbox/blocky-24 -- --run
npm run test:e2e --workspace @playbox/blocky-24
```

游戏源码位于 `src/`，使用精确分数、可复用求解器、原生 DOM 拖拽和 Web Audio API。
