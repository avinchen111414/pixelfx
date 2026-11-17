<p align="center">
  <img src="docs/readme/montage.gif" width="800" alt="同时播放的像素特效网格：篝火、燃烧的骷髅、瀑布、等离子球、传送门、龙卷风等。">
</p>

# pixelfx.

**<!-- count -->244<!-- /count --> 个像素特效与动画，每一个都是一小段代码。** 火焰、爆炸、魔法、天气、UI、拾取物、小生物，应有尽有。可以实时预览播放、重新配色、镜像翻转，直接放进浏览器游戏，或导出精灵表供任意引擎使用。此外还附带一个 Claude Code 技能，像挑剔的像素画师那样创作新特效：起草、渲染、观察、打磨。

每个有角色参与的特效都**带表演**：他起手蓄势、出手、命中瞬间定格、收招，被击中的目标也会挨下这一击。12 套完整招式把特效串成从起手到收招的整套攻击。

**[打开画廊](https://patch-gg.github.io/pixelfx/)** · [特效目录](docs/CATALOG.md) · [表演](#acting) ·
[配套技能](#the-skill) · [自己动手做](#make-your-own) · [实现原理](#how-it-works)

方法出自 [Hugo Duprez](https://x.com/HugoDuprez) 的《[How to make (good) pixel art effects with Claude](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude)》：代码是黏土，相信自己的眼睛，多喂参考图。他在 Sprite Fusion 上的[开源特效](https://www.spritefusion.com/pixel-art-vfx)树立了标杆，`src/core/sim.js` 以及文件开头注明来源的特效都改编自他的代码。本仓库是我们把这个思路做成库级规模的尝试，并配了一个可持续产出的技能。

## 里面有什么。

<!-- catalog -->
| 类别 | 特效数 | 举几个例子 |
|---|---|---|
| **招式 moves** | 12 | 箭矢射击、冲刺斩击、踏地、火球投掷、砸地、神圣惩戒…… |
| **火 fire** | 12 | 火盆、篝火、蜡烛、喷火、火环、火焰龙卷…… |
| **爆炸 explosions** | 12 | 木桶爆炸、大爆炸、卡通砰、尘土爆炸、烟花绽放、烟花火箭…… |
| **水 water** | 12 | 气泡、水滴、喷泉、间歇泉、雨滴飞溅、涟漪…… |
| **冰 ice** | 10 | 暴雪漩涡、冰冻、霜息、冰霜新星、冰晶、冰枪…… |
| **闪电 lightning** | 11 | 球状闪电、连锁闪电、蓄能、带电、雷击、等离子球…… |
| **科幻 sci-fi** | 12 | EMP 冲击、能量核心、力场、故障、全息影像、喷射背包…… |
| **近战 melee** | 12 | 利爪挥击、匕首连刺、二连斩、锤击、重劈、镰刀收割…… |
| **命中 impacts** | 11 | 钝击、弹着、暴击、震地、重落地、命中闪光…… |
| **投射物 projectiles** | 13 | 箭、弹道曳光、炮弹、能量圆盘、信号弹、追踪导弹…… |
| **生成与死亡 spawn & death** | 10 | 金币掉落、崩解、溶解灼烧、破蛋、噗地消失、重生光束…… |
| **秘法 arcane** | 12 | 秘法射线、秘法飞弹、秘法宝珠、闪现出现、闪现消失、魔法阵施法…… |
| **神圣 holy** | 10 | 祝福、神圣护盾、羽翼迸发、光环、治疗、治疗光环…… |
| **暗影 shadow** | 12 | 黑洞、诅咒、暗黑爆炸、日蚀、攫取之手、咒印…… |
| **状态 status** | 13 | 流血、燃烧、魅惑、混乱、被诅咒、冻结…… |
| **自然 nature** | 13 | 酸液飞溅、巨石、地刺、治愈之花、叶暴、毒云…… |
| **天气 weather** | 12 | 极光、暴风雪、樱花、云、落叶、萤火虫…… |
| **UI ui** | 12 | 成就、金币收集、连击计数、彩纸、倒计时、暴击数字…… |
| **拾取物 pickups** | 11 | 开箱、金币旋转、收集迸发、水晶碎片、宝石旋转、拾取爱心…… |
| **转场 transitions** | 10 | 百叶窗、燃尽、显像管关机、菱形擦除、故障擦除、虹膜收缩…… |
| **小生物 critters** | 12 | 蝙蝠、鸟、蝴蝶、眼球、鱼群、飞行骷髅…… |
<!-- /catalog -->

每个特效都是 `src/fx/<category>/<name>.js` 中的一个文件。完整清单见[特效目录](docs/CATALOG.md)。

## 使用一个特效。

**在浏览器游戏里**（canvas、Phaser、PixiJS、Kaplay、three.js）直接用代码，零依赖。

```js
import { createFrame, clearFrame, createFx, composite } from "pixelfx";
import * as frostNova from "pixelfx/fx/ice/frost-nova";

const frame = createFrame(320, 180);                   // 你游戏的像素分辨率
const img = new ImageData(320, 180);
const fx = createFx(frostNova, { x: 160, y: 140 });   // 还可传：flip、angle、seed、palette、light 等

function tick(dt) {
  fx.update(dt);
  clearFrame(frame);
  fx.draw(frame, "back");                              // 画在角色后面
  drawCharacters();
  fx.draw(frame, "front");
  composite(frame, img.data, backgroundColor);         // 先上色，再叠加光照
  ctx.putImageData(img, 0, 0);                         // 用 image-rendering: pixelated 放大
}
```

可以用 `npm i github:patch-gg/pixelfx` 从 GitHub 安装，也可以直接复制 `src/core` 和你需要用到的特效。

**在任意引擎里**（Godot、Unity、GameMaker、Defold、LÖVE、Bevy）用精灵表：

```bash
node tools/render.mjs ice/frost-nova --sheet
```

这会生成一张把所有帧排成网格的透明 PNG，以及一份 Aseprite 风格的 JSON（每帧的矩形区域、时长，还有包含 fps、loop、列数和锚点的 `meta.pixelfx`）。Phaser 的图集加载器，以及 Godot、Unity 的 Aseprite 导入器都能直接读取。运行 `node tools/sheets.mjs` 可以把整个库导出到 `sheets/`。

每个特效都接受一个 `palette`（由暗到亮的十六进制色阶），因此不用改代码，火焰就能烧成蓝色，治疗也能泛出粉光：

```bash
node tools/render.mjs fire/torch --gif --opts '{"palette": ["#102","#215","#43a","#8cf","#cff","#fff"]}'
```

<a id="acting"></a>
## 表演。

<p align="center">
  <img src="docs/readme/acts.gif" width="800" alt="一个灰色假人正在攻击稻草靶：三连剑击、锤击、砸地、神圣惩戒、冰霜新星和带残影的奔跑，每一招都有起手、命中定格和收招。">
</p>

单独一个特效看起来就像贴纸。让打击感成立的，是它周围的身体动作：预示出招的起手、命中瞬间的定格、目标向后踉跄、以及收招。因此，61 个带角色的特效和 12 套招式都写明了身体在什么时候做什么：

```js
export const act = {
  target: { x: 58 },
  poses: [
    [-0.55, GUARD],            // 他在特效开始前就起势（t = 0 是特效的第一帧）
    [-0.3, WIND_UP],
    [0, CUT, "snap"],          // "snap" 保持上一姿势，并在关键帧直接跳变
    [0.06, FOLLOW_THROUGH, "snap"],
    [0.86, GUARD],
  ],
  hits: [{ t: 0.06, stop: 0.14, shake: 0.18, amp: 2, push: 2.8, straw: 18 }],   // 命中时定格 0.14 秒
};
```

把 `createFx` 换成 `createAct`，就能**连角色和目标一起播放整套表演**：

```js
import { createFrame, clearFrame, createAct, composite } from "pixelfx";
import * as slash from "pixelfx/fx/melee/sword-slash";

const act = createAct(slash, { x: 80, y: 140 });

function tick(dt) {
  act.update(dt);                                  // 定格期间会自动静止
  clearFrame(frame);
  act.draw(frame);                                 // 传 { body: false } 和 { target: false } 可省略它们
  composite(frame, img.data, backgroundColor);
  const [sx, sy] = act.shake;                      // 把画面偏移这么多
  ctx.putImageData(img, sx, sy);
}
```

**有自己的角色？** 特效 id 没有变，精灵表里仍然只有特效本身，所以已有游戏照常可用。（画在身体上的特效会描出自带的假人，如果要发布这些，记得重新生成。）时序就是纯数据：读 `slash.act`，或读精灵表 JSON 里的 `meta.pixelfx.act`（`windup`、`recovery`、带 `t` 和 `freeze` 的 `hits`、以及 `poses`）。在特效开始前那么久启动你自己的起手动画，并在每次命中时把一切暂停更新 `freeze` 秒。

画在身体上的特效（冰霜、毒、扫描线）是参照站立姿态的角色绘制的，无论他走到哪里都会跟着他：每个姿势的每个像素都知道自己来自站立身体的哪个像素。用 `node tools/act.mjs <id> --sheet` 可以把包含角色在内的整套表演烘焙成一张精灵表。

这具身体也归你用：`skeleton(pose)` 给出某个姿势在 3D 空间里的每个关节，方便挂上你自己的东西；`posedParts(pose)` 则把每个部位单独画出来给你。

<a id="the-skill"></a>
## 配套技能。

`pixelfx` 技能教会 Claude Code 查找、使用、导出和创作特效。作为插件安装：

```
/plugin marketplace add patch-gg/pixelfx
/plugin install pixelfx@pixelfx
```

或者把 `skills/pixelfx` 复制到 `~/.claude/skills/`。然后直接说出你想要什么：

- "给我法师的大招加一个冰霜新星。"
- "给金币拾取的闪光做五版方案，把最好的两个给我看。"
- "把火和爆炸两类导出成 Godot 用的精灵表。"
- "这个命中特效太飘了，做得更有打击感一点。"
- "给这个法术加上起手动作，并让敌人对此作出反应。"

<a id="make-your-own"></a>
## 自己动手做。

```bash
node tools/new.mjs arcane/my-spell       # 一个可运行的起点（加 --loop 可循环）
node tools/render.mjs arcane/my-spell    # 生成 records/arcane/my-spell/contact.png，看看效果
node tools/check.mjs arcane/my-spell     # 检查溢出、接缝、未设种子的随机数和慢帧
```

然后反复迭代：看接触表（contact sheet），修掉最糟的一处，再渲染一次。`--gif` 和 `--mp4` 能看动态，`--all` 会展示每一帧。`node tools/act.mjs arcane/my-spell` 把一套表演按连续的 12 fps 步进展示出来，因为运动上的问题在抽样图里是看不出来的。[docs/AUTHORING.md](docs/AUTHORING.md) 里有约定、绘图 API 和质量标准。`node tools/serve.mjs` 可以在本地跑起画廊，里面就有你自己做的特效。

<a id="how-it-works"></a>
## 实现原理。

- **两类特效，不用图片。** 纯函数型特效导出 `draw(p, t, o)`，仅由 `t` 就能算出 `t` 秒时的那一帧，因此循环播放可以无缝衔接。模拟型特效导出 `create(o)`，以 120 Hz 步进真实的粒子、碎屑和光源，所以无论帧率多少，火花弹跳和烟雾翻卷都一致。
- **两个缓冲区。** `color` 接收像素：不透明、抖动半透或真正半透明；`light` 接收叠加式辉光，最后加在最上面。灼热的东西之所以看着烫，靠的就是光照缓冲区。
- **一切都有种子。** 每个随机数都由特效的 seed 决定，所以第 40 帧每次都一样。
- **局部坐标。** 特效围绕自身原点绘制，由绘制器负责摆放、镜像和旋转。有方向性的特效一律朝右。状态、光环和命中效果里，用一个 24×38 的自带角色来站位。
- **一副真骨架，一路画到像素级。** 灰色假人是刻意做成中性的，让视线落在动作上，也让任何特效的颜色都能在它身上读得清楚。他是一具 3D 骨架，骨头长度固定，从骨盆到脊柱再到肩膀，用几种平涂色块加一条干净的描边来渲染，做法和《Dead Cells》的精灵一样。因此他能扭转、弯腰、真的转身，前后遮挡由深度决定。姿势按 12 fps 的步进保持，跟手绘精灵一样，而粒子仍以全速运行。
- **帧结构与 Sprite Fusion 的 VFX 相同**（`{ w, h, ox, oy, color, light }`），因此两个库可以画进同一个帧里。

## 许可证。

代码与特效均采用 MIT 许可，可用于任何项目，包括商业项目。部分内容改编自 Hugo Duprez 的 MIT 特效和 Hollow Crown 的 MIT 源码；`gallery/fonts` 中的 Patch Pixel 字体归 Patch 所有，不在本许可范围内：详见 [NOTICE.md](NOTICE.md)。

由 [Patch](https://patch.gg) 制作。
