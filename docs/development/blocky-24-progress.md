# Blocky 24 Development Progress

Original prompt: 设计一个打开即玩的 24 点网页游戏，支持电脑、手机和平板拖拽操作；随机数字可选 1–9 或 1–13，可选择是否出现无解题，并有正计时。视觉采用黄色积木卡通方向。首版只做单机。后续增加了两种卡通音效和 Playbox 多游戏仓库结构。

## Implemented

- Exact rational arithmetic and fraction display.
- Pair-reduction 24-point solver and solvable-puzzle filtering.
- Fixed-slot drag merge game state with source-op-target direction.
- Undo, retry, new puzzle, count-up timer, and persisted settings.
- Mouse, touch, and pen Pointer Events with drag targets and result previews.
- Yellow block-toy interface for desktop, phone, and iPad.
- Victory, failure, merge, rejection, and reduced-motion feedback.
- Debug state hook and deterministic timer advancement for Playwright.
- Removed the visible drag instruction and dashed placeholders left by merged cards.
- Added stable random card faces with ±3.2° tilt.
- Switched visible numbers to bold Trebuchet MS.
- Moved operators to target-card corners with proximity reveal and 56×56 hit boxes (48×48 on phones and landscape).
- Floating card overlap or pointer overlap can select an operator; selected targets grow without overlapping any other hit area.
- Removed both victory and failure panels; the board and controls now carry the result state.
- Simplified settings copy to “简单” and “困难”, moved the title up, made the apply button green, and added hover growth.
- Regular cards now use four mutually distinct colors; mint and peach are reserved for the final win/loss card.
- Removed the drag-time answer preview pill.
- Moved settings hover rules outside the hover media query and added visible feedback to the unsolvable toggle.
- Added `findSolutionStep()` and a bulb hint showing the first operation from the original puzzle.
- Moved circular undo to the game panel and added solution checking states for allowed/forbidden unsolvable puzzles.
- Confirming an unsolvable puzzle pauses the timer and turns the new-puzzle control into “下一题”.
- Hint bubbles sit to the left of the bulb at the same vertical center and dismiss on the next pointer, keyboard, wheel, or touch-scroll action.
- Hint-confirmed solvable puzzles use a neutral white “此题有解” state; manual checks use red and keep the timer running.
- Victory allows undo, freezes the timer through that undo, and shows neutral white “此题有解” plus green “下一题”.
- Retry and new-puzzle controls now share the settings button’s cream color.
- Timer now stops only when “下一题” appears; wrong final boards continue timing.
- Once a round has been won, undo and retry preserve “下一题” and the frozen timer until a new puzzle starts.
- A solvable manual check keeps the hint bulb enabled; only an unsolvable result disables it with a white translucent state.
- Status labels now use “此题有解”/“此题无解”, and status, next, and apply shadows match the retry button.
- Undo uses the rounded long left-arrow reference shape and remains available after victory.
- Undo arrow now has matching rounded top-right and bottom-right corners.
- Hint bubbles sit to the left of the bulb at the same vertical center.
- “下一题” uses the same shadow color as “重来本题”.
- “此题有解”和“此题无解”的检查结果在点击“重来本题”后保持不变；无解状态仍显示“下一题”并保持计时暂停。
- Added procedural tactile and comedy Web Audio palettes, a persisted mute control, and `sound` URL preview options.
- “无解”猜测正确时播放成功音效；猜错时播放失败滑音并触发短暂摇晃。
- Reorganized the project as the Playbox npm workspace with Blocky 24 under `games/blocky-24/`.

## Verification

- `npm test -- --run`: 34/34 passing.
- `npm run test:e2e`: 46/46 passing in local Edge.
- Desktop, 390×844 phone, and 820×1180 iPad screenshots were inspected with no console errors.
- `npm run build` and `npm run verify:pages` pass; the Pages subpath check reports three cards after one merge.
- Production build uses the system Trebuchet MS numeric font stack and has no font package dependency.
- Playbox catalog and `/Playbox/blocky-24/` subpath verification pass.

## Remaining

- Publish Playbox v0.1.0 and verify the live GitHub Pages URL.
- Multiplayer is intentionally deferred.
