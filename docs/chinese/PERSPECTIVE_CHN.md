# 视角适配规则：把平视特效用于 2.5D 有纵深横版

面向「类似火影忍者手游」的 2D 横版：角色可沿纵深轴移动，地面有透视。本文沉淀判断规则与改造清单，供后续复用；**不包含代码改动**。相关约定见 [AUTHORING.md](AUTHORING.md)，可选特效见 [CATALOG.md](CATALOG.md)。

## 1. 术语对照

| 说法 | 含义 | 本库对应 |
|---|---|---|
| front elevation / side view / orthographic | 相机水平、地面成一条线，物件的高度沿屏幕 Y 轴 1:1 | Gallery 里的 `fire/brazier` 等多数演示 |
| billboard | 始终面向相机的贴片，本身不含纵深信息 | 火焰、烟、光柱 |
| 2.5D 横版格斗 / 带纵深轴（depth axis、Z / lane）的横版 | 画面仍横向卷轴，但角色可在纵深方向走动 | 目标游戏 |
| 3/4 view（three-quarter view）、斜俯视 / 高位斜视（oblique / high-angle） | 相机带一个俯角，地面被压扁成窄带 | 需要把特效适配成这种 |
| belt-scroll / beat-'em-up | 有纵深走位的横版清版动作类型 | 同上 |
| isometric（等距） | 两轴各约 30°，横线不平行屏幕 | **不是**目标游戏，别套等距网格 |
| rotation（旋转） | 平面内绕原点转 | `angle` 选项 |
| projection（投影） | 3D 地面 (x, z) 映射到屏幕 (x, y) | `sy` / `SY` 压扁系数 |

关键区分：用户说的「调整角度」实际是**改投影**，不是**改旋转**。

## 2. 结论

- **朝向可调**：`createFx(mod, { angle, flip })` 已内建，是 `Painter.place()` 的 2D 刚体旋转 + 镜像，适合挥砍弧线、投射物、喷流方向。Gallery 的 UI 没暴露它，但 `tools/render.mjs --opts` 和直接调用都支持。
- **视角不可直接调**：`angle` 只对整幅局部坐标做 cos/sin 旋转。给 `fire/brazier` 传 `angle` 会让三脚架、火苗、重力一起歪，得不到俯视效果。库里**没有**统一的相机俯角 / `scaleY` / 透视选项。
- **但完全可改造**：库是「代码即素材」，且**已经内建了正确的斜俯视投影模型**——`(x, z * sy - h)`——只是每个特效把 `sy` 写死在自己的文件里、彼此不一致（0.16 ~ 0.3），也没提升为 `meta.options`。把投影常数参数化即可复用全库。

## 3. 源码证据

| 位置 | 事实 |
|---|---|
| `src/core/painter.js:30-43` | `place(x, y, flip, angle)` 只保存 `cos/sin`，`toX/toY/fromX/fromY` 是刚体变换；`each()` 按屏幕像素反变换到局部空间 |
| `src/core/fx.js:70-74` | `draw()` 每帧调用 `p.place(opts.x, opts.y, opts.flip, opts.angle)`，没有第三个变换参数 |
| `docs/AUTHORING.md:50-58` | 局部坐标 (0,0) 为锚点、x 右 y 下；`x/y/flip/angle/light` 是保留选项 |
| `tools/check.mjs:91` | 校验器禁止 `meta.options` 复用这些保留名 |
| `src/fx/water/_lib.js:34-88` | `Drops` 的标准模型：`on screen they sit at (x, z * sy - h)`，`sy = 0.22`；`z` 是纵深、`h` 是离地高度，重力只作用于 `h` |
| `src/core/sim.js:390-405` | `band()` 注释：`sy squashes it: 0.16 lies on the floor, 1 stands up`；`keep(g)` 分远近半环 |
| `src/fx/arcane/_lib.js:80-98` | `floorRing(p, cx, cy, r, sy, ...)`，`sin(g) > 0` 是近侧，`sin(g) < 0` 是远侧 |
| `src/fx/arcane/magic-circle-cast.js:7-8` | `the floor squashes depth by SY`，`SY = 0.3`，地面法阵压扁、光柱保持竖直 |
| `src/fx/fire/_lib.js:224-234` | `floorLight(p, x, y, rx, ry, ...)` 地面光斑是椭圆；`fire/*` 全部以 `rx/ry ≈ 0.17~0.2` 落地 |
| `src/fx/fire/brazier.js:23,47-55,90-112` | 碗口 `RY/RX = 3/15 = 0.2`、落地光 `40/7 ≈ 0.175` 已是低俯角；但三脚架、火舌、火星全部沿屏幕 `-y` 上升，是纯平视 |
| `gallery/app.js:62` | Gallery 创建实例时只传 `x/y/flip/opts`，未提供视角控件 |

## 4. 判定流程

1. 特效是否**只画在地面上**（法阵、涟漪、冲击环、地裂、影子、落地光）？
   → 直接复用库里已带 `sy` 的构件（`band`、`floorRing`、`water/ripples`、`arcane/magic-circle-cast`、`impacts/ricochet`），零改动，把 `sy` 对齐到游戏的俯角即可。
2. 特效是否**纯方向性**（斩击、弹道、喷射）？
   → 用 `angle`（弧度）+ `flip`，足够。
3. 特效是否**含竖直运动 / 体积**（火焰、烟、光柱、爆炸、粒子上升）？
   → 需要投影适配：地面部分压扁、竖直部分不压，见第 5 节。
4. 只是要一个静态道具且质量不敏感？
   → 可以在引擎里对导出的 sprite sheet 做 Y 向压缩，但火焰高度会一起变矮、1px 线会丢行，**只推荐给纯地面特效**。

## 5. 投影适配规则（复用清单）

约定：世界坐标 `(x, z, h)`，`x` 横向、`z` 纵深（负为远）、`h` 离地高度；`sy` 为地面压缩系数（约等于相机俯角的正弦，平视 0 / 正俯视 1）。

```
screenX = x
screenY = z * sy - h
```

经验值：低俯角 0.16 ~ 0.22（水面、贴地光斑）；3/4 横版 0.30 ~ 0.45；等距约 0.5。`fire/*` 目前用 0.17 ~ 0.2。

| 元素 | 规则 |
|---|---|
| 地面形状（环、裂纹、光斑、影子、涟漪） | 只压 Y：`y *= sy`，横向宽度不变；用 `band` / `floorRing` / `floorLight(rx, ry)` 这类按屏幕像素判定形状的函数，不要对位图整体缩放 |
| 竖直形状（火焰、烟、光柱、角色、飞行物高度 `h`） | **不压**，保持 1:1 高度；重力、上升、生命周期在 `h` 上算 |
| 前后遮挡 | 远半 `sin(g) < 0` 走 `drawBack`，近半走 `draw`；库里 `keep(g)` 已支持 |
| 深度排序 | 与场景角色一起按脚下 `y = z * sy` 升序绘制，y 大者后画（近处盖住远处） |
| `angle` | 只用于方向性特效；叠加时必须**先投影、后旋转**；对有重力/上升运动的效果禁用 |
| 辉光 | `glow` / `glowRing` / `glowLine` 是屏幕空间圆形，没有 `sy` 参数；地面光晕要椭圆化，否则压扁后光斑仍是圆的 |
| 抖动淡出 | Bayer 阈值按屏幕坐标取（`painter.js:49`），投影不影响它 |
| 像素栅格 | 非均匀压缩会丢像素行、1px 线出现空洞；用 nearest-neighbour、整像素量化，压扁后必须渲染 contact sheet 肉眼检查 |
| 选项命名 | `x/y/flip/angle/light` 是保留字，新参数建议叫 `tilt` 或 `sy`，并给默认值保持 Gallery 原样，避免破坏已有 sheet 导出 |
| 锚点 | 仍以 `meta.origin`（脚下 / 器物落地点）为 (0,0)，投影只改绘制内容，不改锚点语义 |

## 6. 三条实现路径（按质量 / 成本）

- **A（推荐，质量最好）**：按第 5 节改造具体特效文件，把 `sy` 提为 `meta.options`。因为每个特效是独立 JS 文件、纯 `draw(p, t, o)` 或 `create(o)`，改一个不影响其他 243 个；可做 `-3q` 变体与原件并存。
- **B（一改全库，但不正确）**：在 `Painter.place()` 加 `scaleY` 或通用 3x2 矩阵。必须同步改 `fromX/fromY` 的逆变换、`each()` 的包围盒、`glow*` 的椭圆化，且无法区分「地面位移」与「竖直高度」——火焰会跟着变矮。只适合快速原型或纯地面类。
- **C（零改动，最省事）**：导出 sheet 后在引擎里对贴图做 Y 缩放 / 斜切，或优先挑选本来就按斜俯视绘制的特效。注意它同样不区分地面与竖直。

## 7. `fire/brazier` 具体适配清单

不改代码，仅记录将来改造时的触点：

1. `RX/RY`（`:23`）：碗口椭圆随俯角变宽，`RY = RX * sy`（当前 0.2）。
2. `stand()`（`:47-55`）：三脚架前后腿按 `z * sy` 做纵深偏移，中腿/环的远近半分到 `drawBack`。
3. `floorLight(..., 40, 7, ...)`（`:90`）：`ry = 40 * sy`。
4. `coals()`（`:72-84`）：俯角变大时碗内可见的炭面要加宽、暗面收窄。
5. 火舌 `burn(...)`、火星 `looped(...)`（`:94-112`）：上升量是 `h`，保持 1:1；水平散布改为 `x` 与 `z` 两个分量，`z` 再乘 `sy`。
6. 导出前用 `node tools/check.mjs fire/brazier` 与 contact sheet 双重验证。

## 8. 验证方式

```bash
# angle is a rotation, not a camera tilt: the tripod and flames lean together
node tools/render.mjs fire/brazier --opts '{"angle":0.2}'

# the effects that already ship with a tilted ground plane
node tools/render.mjs arcane/magic-circle-cast water/ripples
```

检查清单：地面光斑与角色脚下对齐、竖直高度不变、远半环在角色后面、1px 环线不断裂、辉光仍贴合地面、loop 首尾无跳变、`tools/check.mjs` 无越界与未播种随机。

## 9. 复用提示

- 新写特效时直接采用 `(x, z, h)` 三分量，别把纵深写进 `y`，否则后续无法换俯角。
- 一个项目只定一个全局 `sy`，通过 `meta.options` 或构建期常量统一下发，避免各特效俯角不一致。
- 需要多视角时，优先做「同一特效 + 不同 `sy`」的参数化，而不是维护多套手绘素材。
