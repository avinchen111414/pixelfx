---
name: pixelfx
description: 用 pixelfx 库以代码方式制作像素特效与精灵动画。库内置 244 个现成特效，都由角色“演”出来：起手蓄势、命中定格、收招（涵盖火焰、爆炸、水、冰、闪电、科幻、近战、命中、投射物、生成与死亡、秘法、神圣、暗影、状态、自然、天气、UI、拾取物、转场、小生物），可直接放进游戏、重新配色、导出为精灵表或二次混编；还带有“起草、渲染、观察、打磨”的循环，让新特效看起来像手绘动画。适用于：有人想要像素 VFX、精灵动画或精灵表、游戏打击感、某个具体特效（“给法师来个冰霜新星”、“金币拾取的闪光”），想在 Godot、Unity、Phaser 或 canvas 游戏里使用或导出 pixelfx 特效，或想让自己的像素特效变得更好看。
license: MIT
compatibility: Node 18 或更高版本。ffmpeg 可选（用于 GIF 和 MP4 预览）。
---

# pixelfx

用代码写像素特效。每个特效就是一个文件 `src/fx/<category>/<name>.js`，它把内容画进两个缓冲区：
**color**（像素：不透明、抖动半透或真正半透明）和 **light**（叠加式辉光）。不依赖任何图片，因此特效
可以实时播放、重新配色、镜像翻转、换种子重算，并渲染成供任意引擎使用的精灵表。

方法出自 Hugo Duprez（《[How to make (good) pixel art effects with Claude](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude)》）：代码是黏土，相信
自己的眼睛，多喂参考图。一次性写死的提示词只能做出平庸的特效；把草稿渲染出来、看过、再打磨，才能做出好特效。

## 开始之前

1. 在一份 pixelfx 检出里工作。如果当前工作目录没有 `tools/render.mjs`，就在项目旁边克隆一份：
   `git clone https://github.com/patch-gg/pixelfx`。无需安装步骤：这些工具只用 Node。
2. 先确认能跑起来：`node tools/render.mjs fire/torch` 会生成 `records/fire/torch/contact.png`。用你的看图
   工具打开这张 PNG。从今往后，这张接触表（contact sheet）就是你观察每个特效的方式。

## 1. 先找现成的特效

`node tools/list.mjs <words>` 会搜索 id、名称、标签和描述（`node tools/list.mjs frost`、
`node tools/list.mjs slash loop`）。`docs/CATALOG.md` 按类别列出了全部特效。先把候选特效渲染出来看一眼，
再做选择。大多数需求其实就是给现成特效换一组选项：

- `palette`：主色阶，由暗到亮，用十六进制字符串表示。可以用 `src/core/color.js` 里任意一条 `PAL` 色阶（fire
  ember lava smoke dust ice water electric volt poison holy heal arcane shadow blood earth stone gold leaf wood metal
  bone neon cyber matrix candy night），也可以自己写。蓝色火焰就是 `{"palette": PAL.ice}`。
- `seed` 换一个等效但不同的版本；`flip` 让它朝左；`angle` 旋转；`light`（0..1 及以上）控制辉光
  强度；再加上每个特效自己在 `meta.options` 里的旋钮（size、count、radius、text、height 等）。
- 不改代码就能试选项：`node tools/render.mjs fire/torch --opts '{"palette":["#102","#215","#43a","#8cf","#fff"]}'`。

## 2. 放进游戏里

**JS/TS 写的 Canvas 或 WebGL 游戏**（原生 canvas、Phaser、PixiJS、Kaplay、three.js）：直接用代码。它
没有依赖；复制 `src/core` 和需要的特效文件即可，或者直接依赖本仓库。

```js
import { createFrame, clearFrame, createFx, composite } from "pixelfx";   // src/core/index.js
import * as frostNova from "pixelfx/fx/ice/frost-nova";                   // src/fx/ice/frost-nova.js

const frame = createFrame(320, 180);            // 游戏的像素分辨率；ox、oy 让它随镜头滚动
const img = new ImageData(320, 180);
const fx = createFx(frostNova, { x: hero.x, y: hero.y, flip: hero.facing < 0 });

// 每帧
fx.update(dt);
clearFrame(frame);
fx.draw(frame, "back");    // 画在角色后面的部分
drawCharacters();          // 你自己的精灵，也可以自己画进 frame.color
fx.draw(frame, "front");
composite(frame, img.data, background);   // 颜色叠在背景上，再加光照；传 null 则输出透明背景
ctx.putImageData(img, 0, 0);              // 然后用 image-rendering: pixelated 放大画布
if (fx.done()) removeIt();               // 一次性特效会自行结束；fx.stop() 让循环特效淡出
```

多个特效可以共用一个帧。在 WebGL 引擎里，可以每帧把合成后的 RGBA 上传成纹理；也可以像下面那样把特效
一次性渲染成精灵表，当成普通动画播放。

**任意引擎**（Godot、Unity、GameMaker、Defold、LÖVE、Bevy、Construct）：导出精灵表。
`node tools/render.mjs ice/frost-nova --sheet` 会生成 `records/ice/frost-nova/frost-nova.png`（网格排列的
透明帧）和 `frost-nova.json`（Aseprite 风格的帧信息，因此 Phaser 的图集加载器、Godot 与 Unity 的 Aseprite
导入器以及大多数工具都能读取；`meta.pixelfx` 里有 fps、loop、帧尺寸、列数和锚点）。把轴心（pivot）设为
`meta.pixelfx.pivot`（特效的原点，例如脚底），导入时用最近邻过滤且不压缩，并按 `meta.pixelfx.fps` 播放。
辉光会以带 alpha 的颜色烘焙进精灵表，在暗场景上看起来就像叠加发光；如果是亮场景，就渲染一个重新配色的
版本，或把特效放在暗色图层上。

要导出整个库：`node tools/render.mjs <category> --sheet` 可以一次处理整个类别。

**一次命中，背后得有身体。** 光有特效看起来就像贴纸。带角色的特效都附带一个 `act`：身体什么时候起手、
什么时候定格、目标怎么反应。不管游戏怎么搭，都能用上它：

- 用自带角色：把 `createFx` 换成 `createAct(slash, { x, y })`。调用 `act.update(dt)`、`act.draw(frame)`，并按
  `act.shake` 抖动整个画面。定格期间它会自动静止。`node tools/act.mjs <id> --sheet` 会把这一整套烘焙成精灵表。
- 用游戏自己的角色：读取时序，即 `slash.act` 或精灵表 JSON 里的 `meta.pixelfx.act`（`windup`、`recovery`、`hits`
  带 `t` 和 `freeze`）。在特效开始前 `windup` 秒播放角色的攻击动画，并在每次命中时把一切——特效和角色都算上——
  暂停更新 `freeze` 秒。宿主侧实现命中停顿对任何特效都有效，不论有没有 `act`。

`src/fx/moves/` 里是把特效串起来的整套攻击，从起手到收招：当有人要的是“招式”而不是“特效”时，从这里开始找。

## 3. 做一个新的

先读 `docs/AUTHORING.md`：那里写明了约定（meta、纯函数型特效的 `draw(p, t, o)` 或模拟型特效的 `create(o)`、
局部坐标、无缝循环、结束时清空）、工具箱、绘制器 API 和质量标准。然后：

1. **用一行说清楚**，并给出美术方向：它是什么、怎么动、用什么配色、什么节奏。“冰霜新星：晶体从脚底向外
   成环迸出，中心一道白闪，碎片旋转飞散，地面留下一层霜再慢慢淡去。”
2. **在库里找参考**：`node tools/list.mjs <words>`，然后读两三个最接近的特效文件，把它们的手法借过来
   （`src/core/sim.js` 里的 `Particles` 和 `Bits` 用来做火花、烟和碎屑，`p.disc` 做半透明体积，`cycle` 做无缝循环粒子，
   `tileFbm` 做火焰与水流的滚动）。也去看看 [Hugo Duprez 的特效](https://www.spritefusion.com/pixel-art-vfx) 里最接近的
   那个：它们就是质量标杆。如果在同样的屏幕尺寸下，他的版本细节更多、光更足或更有生气，说明你的还没做完。
3. **打草稿。** `node tools/new.mjs <category>/<name>`（加 `--loop` 表示循环）会生成一个能跑的文件。当方向
   还没定时，写 3 到 5 个真正不同的草稿（`<name>-a.js` 到 `-e.js`），全部渲染出来
   （`node tools/render.mjs "<category>/<name>-*"`），每张接触表都看过之后再做选择。如果用户在线，把最好的
   两三个给他看（`--gif` 可以生成便于分享的动画）。
4. **看、判断、修。** 渲染，打开 `records/<id>/contact.png`，像挑剔的像素画师那样评判。修掉最糟的一处，
   再渲染。至少三轮；要做出镇场之作还得更多。`--all` 展示每一帧，`--mp4` 以全速展示动态。
5. **有角色就把它演出来**：加上 `export const act`（见 `docs/AUTHORING.md` 的 “Acts” 一节），包含 t = 0 之前的
   起手、出手帧的姿势变化、命中定格和收招。`node tools/act.mjs <id>` 会展示连续的 12 fps 步进：判断运动要看
   这些帧和 `--mp4`，而不是接触表里的抽样图。
6. **检查。** `node tools/check.mjs <id>` 会抓出：画到画布外、一次性特效结束时没清空、循环接缝、未设种子的
   随机数和慢帧；对 `act` 还会检查关键帧顺序错乱、未知姿势字段和手部瞬移。改到干净通过为止，并删掉
   没保留的草稿。

要看什么，以及通常怎么修：

| 你看到的问题 | 修法 |
|---|---|
| 1 倍尺寸下糊成一团 | 减少颜色、轮廓清晰、只留一个视觉焦点、把形状放大 |
| 斑点：形状内部有孤立的噪点像素 | 降低噪声阈值、用 `at()` 量化、小形状上不加噪声 |
| 发飘、没有打击感 | 快进慢出（`ease.outQuart`/`outExpo`）、加 1 到 2 帧白色高光主帧、缩短总时长 |
| 僵硬、机械 | 让每个粒子都有差异（大小、速度、延迟、寿命），加上次级运动（火花、烟、碎屑） |
| 发白、褪色 | 降低辉光（k 取 0.2 到 0.5）、把边缘色阶压暗、白色只留给最热的核心 |
| 扁平 | 设定单侧光源：左上更亮、右下色阶更暗；底部再压暗一级色阶 |
| 平滑渐变、矢量感 | 颜色只用硬色阶；柔和只留给光照和半透明的烟 |
| 该有烟的地方出现棋盘格 | 用 `SMOKE`、`VAPOUR` 或 `DUST` 粒子，或 `p.disc`：真正半透明，并在其上补光 |
| 循环回绕处有接缝 | `cycle`、`loopNoise(phase)`、整格 `tileNoise` 滚动、`sin(phase * TAU * n)` |
| 一次性特效突然消失 | 让它在 t = duration 之前缩小、抖动淡出或飘落离场 |
| 特效很好，角色却像死了一样 | 给它加 `act`：起手、出手姿势、命中定格、会反应的目标、收招 |
| 表演没有重量感 | 起手方向与出招方向相反、延长定格（最多 0.2 秒）、加大轮廓变化、加抖动 |
| 命中时机对不上 | 把命中关键帧对齐到特效自身的常量，而不是凭眼睛估的时间 |
| 握武器的姿势别扭 | 手肘保持弯曲，长柄放在胸前；挥动时刀刃要滞后于手；手臂伸展约 15 px 且不能拉长，所以要让身体跟进去 |
| 双臂交叉，或姿势看着扁平 | 他是四分之三侧身朝向我们：张开双臂时，近侧手往左（`fx < 0`）、远侧手往右，并配合 `turn: 1`；`yaw` 能让他真正转身 |

有方向性的特效朝右，地面特效立在 y = 0 上，角色特效包裹 `o.actor`（一个 24 x 38 自带角色的遮罩与
像素），任何地方都不要用 `Math.random`。通用母题没问题；但绝不要复刻某个具体游戏的精灵、角色或 logo。

## 4. 用原生代码代替 JS

如果游戏跑不了 JS，而精灵表又不够用（比如特效要跟随移动目标，或运行时需要按实例改色），就把特效移植过去。
纯函数型特效就是时间的函数；模拟型特效则在 `src/core/sim.js` 里步进粒子。保留双缓冲区的思路、用于抖动 alpha
的 4x4 Bayer 阈值，以及色阶查表的方式。把 JS 原版和移植版并排渲染出来，核对两者是否一致。
