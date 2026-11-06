# 角色制作与渲染说明

本文归纳 `README.md` 的 [acting](../README.md#acting) 与 [how it works](../README.md#how-it-works) 两节中关于**角色**的部分：灰色假人（dummy）是怎样被生成和渲染的、代码在哪、项目为此准备了哪些资源，以及要换成自己的角色时应按什么规格准备资源。

相关文档：[写作规范 AUTHORING.md](AUTHORING.md)（特效契约、Acts、绘制 API）、[特效目录 CATALOG.md](CATALOG.md)、[中文 README](../README_CHN.md)、[技能说明](../SKILL_CHN.md)。

---

## 1. 系统定位

`how it works` 前几条讲的是**特效**的渲染（纯函数/粒子模拟、双缓冲、种子、局部坐标、帧格式）；角色那条 bullet 讲的是**表演系统里角色本体**的生成：3D 骨架 → IK 解算 → 深度缓冲光栅化 → 平涂加墨线 → 2D 像素列表。

项目里有两套角色表示，不要混淆：

| | 静态站立假人 | 动态骨架假人 |
|---|---|---|
| 来源 | `src/core/actor.js` 的 `HERO2` 字符画（24×38） | `src/core/rig.js` 运行时求解 |
| 用途 | 纯特效读取 `o.actor.mask/pixels`、预览、onBody 特效的站立底图 | `createAct()` 的起手／命中／收招整套动作 |
| 关系 | 注释写明它是 rig.js 静止姿势（`STAND`）的**离线烘焙**，两者必须严格对齐 | 产出 `posed(pose)` 像素表 |

所谓 "3D skeleton" 不是 mesh 或模型贴图：三维只用于关节解算与遮挡判断，最终交给合成器的仍是一张 2D 像素表。因此**不需要准备任何 3D 模型资源**。

---

## 2. 渲染管线

```
act.poses（关键帧数据）
  → poseAt() 12 fps 取姿势
  → solve() IK 反解关节（rig.js）
  → sphere / sweep / ellipsoid 光栅化，深度缓冲定遮挡
  → finish() 四阶平涂 + 接缝 + 墨线 + src 映射
  → posed(pose) = { n, xs, ys, color, src, ink, 包围盒, z }
  → createAct().draw() 按 back / 靶 / 身体 / front 合成到 frame
```

### 2.1 姿势数据

姿势只描述**手脚末端在哪、身体怎么发力**，其余关节由解算器推出。字段说明见 `src/core/poses.js`，起始姿势为 `READY`；各特效文件里的 `export const act` 提供 `poses / hits / target / dust`（61 个带角色特效 + 12 个 moves）。

- 坐标：局部空间，脚在 `(0, 0)`，x 右、y 负为上；`fx/fy` 近手、`bx/by` 远手、`ffx/ffy` 近脚、`fbx/fby` 远脚。
- `lean / crouch / turn / twist / yaw` 控制躯干与整体转向；`weapon / sa / two / wl / wz` 控制持械；`ghost` 留残影。
- 骨骼定长，手臂约 15px、腿约 17px，够不到就挪身体（`x`），`shortfall()` 会报出缺口。
- 方向默认朝右、四分之三朝向观众；近手在胸左（`fx < 0`）、远手在右（`bx > 0`）。

### 2.2 解算与光栅化

- `src/core/rig.js` 的 `M` 是骨长表（骨盆 19.7、大腿 8.6、小腿 8.3、上臂 7.6、前臂 7.4……），`ik()` 是双骨 IK，`solve()` 依次求骨盆→腰→胸→颈→头、肩/肘/手、髋/膝/踝，并用 `rotY/rotZ` 处理转体与 `yaw`。
- 300×240 的 scratch grid 上有 `Zb`（深度）、`Tone`（法线光照）、`Part`（部件编号）、`Mat`（材质）、`Fr`（所属骨骼 frame）；`plot()` 以 z 决定谁在前面。
- `WEAPONS` 的 11 种武器（`sword greatsword dagger spear hammer scythe claw bow pistol launcher handle`）沿手柄逐像素绘制，共用同一深度缓冲，因此武器能真正绕到身前／身后。

### 2.3 平涂、墨线与 src

`finish()` 把 `dot(normal, LIGHT)` 量化为 4 阶明暗，套 `SHELL`（亮壳）/ `CORE`（暗核）灰阶；远侧肢体整体压暗一阶；孤立像素做邻域去噪；部件交界按 z 差决定软接缝 `SEAM` 还是墨线 `INK`；最后补一圈 1px 外轮廓。

每个输出像素还带 `src`：`srcFor()` 用骨骼 frame 逆变换，把姿势像素映射回站立 24×38 网格的 `r*24+c`。这是 onBody 特效（冰霜、毒、扫描线）能贴在运动身体上的唯一依据。

### 2.4 站立图与逐像素归属：`HERO2` / `Part` / `Fr` / `src`

**先澄清一个常见误解**：`src/core/actor.js` 的 `HERO2` 字符画里，字母只是 `DUMMY_PAL` 的**颜色键**（`A~D` 亮壳四阶、`E~G` 暗核、`k` 墨线、`J` 接缝、`m` 胸前标记），**不含任何部位标记**——同一个 `k` 遍布全身，反推不出部位。`maskOf()` 只生成 0/1 轮廓，`pixelsOf()` 只生成颜色数组；`stockActor(2)` 附带的 `head / chest / eyes` 是三个锚点，也不是逐像素标签。

更关键的是：**动作姿势不是把站立图的像素按部位搬到新位置**，而是每帧由 `solve(pose)` → `drawBody()` → `finish()` 从 3D 骨架**重新光栅化渲染**。`HERO2` 自始至终是静止贴图，只在 onBody 特效里充当"颜色样本"。骨骼动画常见的"顶点 → 骨骼权重 → 正变换"在这里方向恰好相反。

不过运行时确实有两套逐像素归属，都由 `plot()` 在渲染姿势时写进深度缓冲，**都不来自 `HERO2`**：

| 缓冲 | 内容 | 粒度 | 用途 |
|---|---|---|---|
| `Part[i]` | `PART` 表 1..24（`pelvis/chest/handN/footF/weapon…`） | 24 个部件 | 部件交界画接缝／墨线、远侧肢体压暗一阶、`posedParts()` 分件 |
| `Fr[i]` | `FRAME_IDS`（`rig.js:145`）的 15 根骨骼 frame 索引 | 更粗：近臂 4 个 part 只对应 `upperN/foreN` 两个 frame | 计算 `src` |

部位号由"哪个几何体画了这个像素"隐式给出：`drawBody()` 里 `useFrame(name)` 设当前骨骼，再把 `PART.*` 传给 `sphere/sweep/ellipsoid`；`plot()` 在 z 竞争后记下最后胜出的 `part` 与 `curFrameIndex`，所以深度也决定归属。武器经 `along()` 时把 `curFrameIndex` 置 `-1`，故武器像素没有来源格。`posed()` 的输出里**没有 part**；`posedParts()` 是靠 `onlyPart` 把每个部件重新渲染一遍得到分件。

**`src` 更像 UV，不是骨骼权重**：`finish()` 的 `srcFor()` 用 `Fr[i]` 找到当前姿势的骨骼 frame `A` 与站立骨架的同名 frame `R0`（`REST_FRAMES = solve({}).B`，`rig.js:457`，模块加载时算好），先逆变换再正变换：

```js
// src/core/rig.js: srcFor()
const lp = tv(A.R, sub(P, A.t));          // screen point -> this bone's local space
const rp = add(R0.t, mv(R0.R, lp));       // same local point -> rest skeleton
const c = Math.round(rp[0]) + 12, r = 38 - Math.round(rp[1]);
return r * W0 + c;                        // index into the standing 24x38 grid
```

即"当前姿势这个像素，相当于站立贴图的哪一格"，是算出来的而非标出来的；界外与武器返回 `-1`。`W0=24/H0=38`、`+12/-38` 是两套数据的对齐约定。

**`src` 只在 onBody 生效，搬的是颜色而不是位置**。`createAct()` 的非 onBody 分支直接 `paint(i, r.color[i])`，完全不看 `src`；onBody 分支才用 `src → NEAREST → REST_PX / B.color` 取样：`NEAREST` 把落在空格的 `src` 兜底到最近身体格（手臂举起时站立图对应位置常是空的），`REST_MASK/REST_PX` 由 `HERO2` 烘焙（`act.js:167-173`），`restIndex()` 硬编码 `c-12`、`r0-38`，`carry()` 按站立色与姿势色的亮度比缩放特效色；特效没改过的格子直接用姿势自身的 `r.color[i]`。这也解释了为什么 `HERO2` 必须是 rig.js 静止姿势的烘焙，且 `REST_FRAMES`、`REST_MASK`、`restIndex()` 三处的 24/38/12 必须严格一致。

**对自定义角色的含义**：`createFx + o.actor` 的 status/aura 特效、以及不带 onBody 的表演都**不需要部位标记**——`src/fx/status/_lib.js` 的 `shape(a)` 只从 `mask` 推断 `body/up/side/outline/top/rows` 等几何特征（列顶、侧边、外轮廓）来长冰霜／火焰，没有"手臂""头部"这类语义。只有要做 onBody 跟随或 `posedParts()` 分件时，才需要自己提供等价的 `posed()` 输出（见 5.3）。

### 2.5 合成与时间

`src/core/act.js` 的 `createAct().draw()` 负责阴影、残影、稻草靶、特效前后层与抖屏；`onBody` 分支先在离屏帧上把特效画到站立假人，再用 `src → NEAREST → REST_PX` 把颜色搬到当前姿势，并按姿势自身的明暗用 `carry()` 校正。

两套时间刻度并存：

| 对象 | 频率 | 实现 |
|---|---|---|
| 姿势 | **12 fps 台阶**，逐帧保持，`x/y` 位移保持平滑 | `poseAt()` 的 `stepped`，`actBounds()`、`tools/act.mjs` 也按 `1/12` 采样 |
| 粒子/物理 | **120 Hz 或更高**，与显示帧率无关 | `createFx().update()` |

---

## 3. 代码地图

| 文件 | 职责 | 关键符号 |
|---|---|---|
| `src/core/rig.js` | 3D 骨架、IK、深度光栅化、平涂墨线、武器形状 | `M`, `STAND`, `solve`, `plot`, `drawBody`, `WEAPONS`, `finish`, `posed`, `skeleton`, `posedParts`, `shortfall` |
| `src/core/actor.js` | 站立假人字符画、调色板、mask/pixels | `HERO`, `HERO2`, `HERO_PAL`, `DUMMY_PAL`, `stockActor`, `drawActor`, `actorAlphaOf` |
| `src/core/poses.js` | 姿势字段说明、起始姿势 | `READY` |
| `src/core/act.js` | 表演装配、12fps 采样、靶子、onBody 搬运、时序导出 | `poseAt`, `createAct`, `Target`, `SKINS`, `REST_MASK/REST_PX/NEAREST`, `actTiming`, `actBounds` |
| `src/core/fx.js` | `o.actor` 注入、帧与 120Hz 更新、双缓冲合成 | `resolveOptions`, `createFx`, `createFrame`, `composite` |
| `src/core/index.js` | 对外 API 汇总 | `skeleton`, `posedParts`, `createAct`, `stockActor` 等 |
| `tools/check.mjs` | 姿势合法性校验 | `POSE_KEYS`, `shortfall`, 12fps 手部跳变检测 |
| `tools/lib/fxlib.mjs` | 预览与 sprite sheet 导出 | `renderFrames`, `renderAct`, `spriteSheet` |

---

## 4. 项目准备了哪些"资源"

**没有外部图片／模型文件**：`docs/readme/*.gif` 只是 README 演示动图；`records/`、`sheets/` 是工具生成目录。全部"资源"都是代码里的常量、字符画和启动时预计算的表。

| 类别 | 具体内容 |
|---|---|
| 几何 | 骨长 `M`、`STAND`、部件编号 `PART`、`FRAME_IDS`、300×240 scratch grid 与深度缓冲 |
| 材质 | `DUMMY_PAL`（灰阶 `A~D` 亮壳、`E~G` 暗核、`k` 墨线、`J` 接缝、`m` 胸前标记）、`LIGHT` 光向、`STEEL` 武器配色 |
| 站立图 | `HERO2`（24×38，骨架 rest pose 烘焙；字母只是颜色键，不含部位信息，见 2.4）、`HERO`（12×19 旧尺寸彩色版）；由 `HERO2` 预计算 `MASK/PIXELS` 与 `REST_MASK/REST_PX/NEAREST` |
| 武器 | `WEAPONS` 11 种程序化像素形状 |
| 表演数据 | 各特效的 `export const act`：`poses`、`hits`（`t/stop/shake/amp/push/skin`）、`target`、`dust`；由 `actTiming()` 转成纯数据 |
| 靶子 | 38×52 稻草靶像素 `DUMMY`、`SKINS`（`flash/char/ice/shadow/holy/red/shock/poison`）、`Target` 弹簧物理与碎屑 |
| 运行时 | `posed()` 的 6000 条姿势缓存、12fps 采样、120Hz 粒子步进、双缓冲 `color/light` |

统一约定：**颜色是 Uint32 `0xAABBGGRR`**（R 在最低字节，定义见 `src/core/color.js`，0 表示空像素）；rig 内部数学用 y 向上，姿势与输出像素表用屏幕坐标 y 向下、`-fy` 换算。

---

## 5. 换成自己的角色

项目**没有加载自定义角色资源的接口**（无 `--actor/--skin` 选项，不读 PNG/ASE/JSON 角色文件；`SKINS` 是给靶子换色）。官方做法见 [README: Got your own character?](../README.md#acting)：特效不动，游戏用自己的角色，复用项目的时序数据。

### 5.1 路径 A：游戏内替换（推荐）

**角色图规格**

- 1px 粒度的像素图，按 **24×38 尺度**绘制（所有特效按此尺度设计，见 [AUTHORING.md: The contract](AUTHORING.md#the-contract)）；局部坐标**脚在 `(0,0)`**，x 右 y 下，默认朝右，镜像交给 `flip`。
- 颜色保持中性／低饱和，让特效的颜色读得出来；默认方向性特效一律朝右。
- 动画按 12fps 关键帧出图（想与内置节奏一致时），特效与粒子仍按全帧率播放。

**外部精灵图怎么挂到对应位置**

项目不读图片，也没有"绑定到骨骼"的 API；挂接靠三件事：**统一局部坐标系**、**`o.actor` 数据契约**、**分层绘制**。

1. PNG 解码成 `ImageData` 后转成 actor 对象：`mask`（0/1 轮廓）、`pixels`（`Uint32Array`，`0xAABBGGRR`，0 为透明，alpha 建议二值化）、`x/y = -脚的像素坐标`、`head/chest` 转成局部坐标。生成逻辑见 `src/core/actor.js` 的 `maskOf() / pixelsOf() / stockActor()`。
2. 用 `painterFor(frame).place(FX, FY, flip)` 画角色，`createFx(mod, { x: FX, y: FY, flip, actor: myActor })` 放特效，两者共用同一套镜像／旋转变换（见 `src/core/painter.js` 的 `place()`）；按 `actorAlphaOf()` 控制角色显隐。不要调用项目的 `drawActor()`，它只画内置字符画。若直接写 `frame.color` 绕过 painter，镜像列要自己算成 `FX - (actor.x + i) - 1`。
3. 按落点给特效传 `x/y`：

| 落点 | 挂法 |
|---|---|
| 脚／地面 | `createFx(mod, { x: FX, y: FY, flip })`，与角色脚同点 |
| 身体轮廓／重着色 | `createFx(mod, { x: FX, y: FY, actor: myActor })`，效果读 `mask/pixels/head/chest` 自己贴 |
| 手／发射点／枪口 | `x: FX + hand[0], y: FY + hand[1]`，hand 来自自己精灵的挂点表或 `skeleton(pose).joints.handN` |
| 命中点 | `hits[].t` 时刻放到目标身上；`act.target.x` 换成自己目标的局部坐标 |
| 武器尖／挂件 | `skeleton(pose).joints` 或 `posedParts(pose)` |

`flip` 交给 painter，不要手动改挂点的 x；方向性特效默认朝右。项目没有 `scale` 选项：整体在低分辨率 frame 里渲染，最后用 `image-rendering: pixelated` 放大，别单独放大角色。特效发射点要与自己精灵的手部挂点对齐（内置特效就是这么做的：`arcane-beam.js` 的光束起点 `HX/HY` 对齐 `act.poses` 释放帧的 `fx/fy`）。若是在引擎里用导出的 PNG 而非运行时代码，则把 sprite 的 origin/pivot 设成 `meta.pixelfx.pivot` 再放到对应锚点。

**分层与显隐**

```js
fx.draw(frame, "back");
drawCharacters();
fx.draw(frame, "front");
```

若用 `createAct()`，`act.draw(frame, { body: false, target: false })` 会在一次调用里画完 `back` 和 `front`，没法在中间插入自己的角色。此时改用 `act.update(dt)` 驱动状态机，手动 `act.fx.draw(frame, "back")` → 画角色 → `act.fx.draw(frame, "front")`，`act.shake` 与 `act.targets` 自行取用；或干脆走 `createFx + actTiming()`。`act.shake` 给出抖屏偏移。

**时序数据契约**（`mod.act` / `actTiming()` / sprite sheet 的 `meta.pixelfx.act`）

| 字段 | 用途 |
|---|---|
| `windup` | 在特效 `t=0` 之前多少秒开始起手动画（负时间关键帧） |
| `recovery` | 特效结束后的收招时长 |
| `hits[].t / freeze` | 命中时刻，以及全场停止更新 `freeze` 秒（通常 0.03–0.2s） |
| `hits[].shake / amp` | 抖屏时长与幅度；`push` 让目标后仰 |
| `poses[]` | 关键帧时间、缓动方式（`smooth/out/in/line/snap`）与姿势数据 |

还可调用 `skeleton(pose)` 取得 3D 关节挂自己的武器／挂件，`posedParts(pose)` 取得分件图。

**注意事项**

- `tools/render.mjs <id> --sheet` 导出的 PNG **只有特效**（`fxlib.mjs` 用 `bare` 帧），特效 id 不变，已有游戏照常可用。
- `tools/act.mjs <id> --sheet` 烘焙的是**含内置假人**的整套表演，若要发布这类素材必须重新生成。
- onBody 类特效（冰霜、毒、扫描线）是画在站立身体上的；用自己的角色时需要自行按 `mask/pixels` 做重着色，或避开 `onBody` 分支。

### 5.2 `o.actor` 契约及其局限

`meta.actor === 2` 的效果会拿到 `o.actor = { mask, pixels, x, y, w, h, head, chest }`（见 [AUTHORING.md](AUTHORING.md#the-contract)）：`mask` 是 `{w,h,data:Uint8Array}` 的 0/1 轮廓，`pixels` 是 `Uint32Array`（0 为空），`x/y` 是 mask 左上角相对脚的偏移，`head/chest` 是局部锚点；`actorAlpha(t,o)` 控制显隐。

`resolveOptions()` 不会覆盖调用者传入的 `o.actor`。对**直接用 `createFx` 播放的 `actor: 2` 特效**，这已经是完整接口：效果自己按 `A.x+i, A.y+j` 用 `mask` 算轮廓、用 `pixels` 重画身体（例如 `src/fx/status/frozen.js` 的 `draw()` 与 `src/fx/status/_lib.js` 的 `shape()/colorAt()`），自定义角色会完整生效。

受限的只是项目自己的两处：`drawActor()` 只按 `actor.k` 从内置 `SPRITES` 取字符画、不看 `pixels`（影响内置预览）；`createAct()` 的 onBody 分支硬编码 24×38 的 `REST_MASK/REST_PX/NEAREST` 与 `restIndex()`（影响整套表演）。前者在自己游戏里不用它即可，后者见 5.3。

### 5.3 路径 B：替换库内假人（需改源码）

核心不是"换一张图"，而是提供等价的 `posed(pose)` 输出，并让所有烘焙数据严格对齐：

| 必须满足 | 原因 |
|---|---|
| 输出 `{ n, xs, ys, color, src, ink, x0,y0,x1,y1, z }`；脚在 `(0,0)`、y 向下；颜色 `0xAABBGGRR` | `createAct().draw()` 只消费 `xs/ys/color`；`actBounds()` 依赖包围盒 |
| 每像素 `src` 指向站立 24×38 网格的 `r*24+c` | onBody 特效靠 `src → NEAREST → REST_PX` 搬运颜色 |
| 同步重做 `HERO2` 站立烘焙图、`REST_MASK/REST_PX/NEAREST`，并让 `drawActor()` 画新图 | `act.js` 中这三张表与 `restIndex()` 硬编码 24×38 |
| 换体型则改 `M` 骨长、`W0/H0`、`drawBody()` 部件半径、`WEAPONS` 长度、`DUMMY_PAL` | 骨骼定长，改尺寸会让既有 `act.poses` 的手够不到目标 |
| 重新校准 `meta.origin`、画布与 `meta.pixelfx.pivot` | `actBounds()` 以 1/12 步长采样 `posed()` 决定画布 |
| 用 `node tools/check.mjs <id>` 全量回归 | 检查未知姿势字段、手部瞬移、循环接缝、freeze 过长等 |

### 5.4 导出规格

透明 PNG（RGBA8888，网格排列）+ Aseprite 风格 JSON：`frames[]` 给出 frame rect 与毫秒 `duration`；`meta.pixelfx` 给出 `fps / loop / frames / frameSize / pivot / columns`，有 act 时附 `act`（`actTiming()` 的结果）。`tools/render.mjs --sheet` 只有特效，`tools/act.mjs --sheet` 含整套表演，`tools/sheets.mjs` 导出全库。Phaser 的 atlas loader 与 Godot/Unity 的 Aseprite 导入器按此读取。

---

## 6. 检查清单

- [ ] 角色图 24×38 尺度、脚在原点、默认朝右、1px 粒度
- [ ] 分层顺序 `back → 角色 → front`，或 `body:false` 关掉内置假人
- [ ] 起手提前 `windup` 秒，释放帧剪影变化大，收招覆盖 `recovery`
- [ ] 每个 `hits[]` 停 `freeze` 秒并抖屏，`freeze` 不超过 0.3s
- [ ] 姿势按 12fps 台阶，粒子／特效保持全帧率
- [ ] onBody 素材用 `tools/act.mjs --sheet` 重新生成，或自行重着色
- [ ] `node tools/check.mjs <id>` 通过：`shortfall` 不超过 3.5px、12fps 内手部不跳变超过 30px、循环首尾无缝

常用命令：

```bash
node tools/render.mjs <id> --sheet
node tools/act.mjs <id> --sheet
node tools/act.mjs <id>                # consecutive 12 fps steps, to judge motion
node tools/check.mjs <id>
node tools/sheets.mjs
```
