# 幸运硬币选择 项目规划与方案文档（z.plan.md）

> 小红书「小工具」。丢硬币决策：正面 yes 反面 no，多局模式（三局两定 / 五局三定 / 自定义 X局Y定 / 一局定输赢）收敛到最终决策。交互趣味化优先，逻辑可解释、结果可复现。
> 本文档为项目规划与方案文档，执行清单见 `x.progress.md`。

## 观察项豁免定案清单（历轮汇总）

（本项目起步，暂无观察项）

---

## 一、项目目标

| 维度   | 目标                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| 玩法   | 丢硬币决策，支持单局（一局定输赢）与多局（三局两定/五局三定/自定义 X局Y定）模式 |
| 决策   | 多局先达 Y 个同面即定；一半一半打满加赛一局定生死                               |
| 交互   | 3D 硬币滑动加速旋转、超时自动减速落定；数字滑动选择器；浮窗成绩/设置            |
| 可复现 | seed + config 版本记录；同一 seed 同结果                                        |
| 呈现   | 硬币三面（展示面 / yes / no），2 套主题可换；单屏自适应（注：现实现已改双面）   |

## 二、技术选型

- 纯 HTML5 单页应用（HTML + CSS + JS），无后端，无构建步骤（纯静态 ES Module）
- 硬币 3D 效果：CSS3 `perspective` + `transform: rotateY()` + `transform-style: preserve-3d`（容器禁 WebGL，CSS 3D 首选）
- 可复现随机源：mulberry32 + seed 管理
- 模块分层：通用工具 → 配置 → 业务核心（规则/对局状态机/硬币动画）→ 界面 → 静态数据 + 运行数据

## 三、核心玩法与算法

### 模式按钮（互斥单选，可取消）

- 顶部三个按钮：`三局两定` / `五局三定` / `自定义`（数字滑动选择器）
- 任意时刻至多一个按下；再按已按下按钮 = 取消激活
- 全部未按下 = **一局定输赢**（单次抛硬币直接出结果）

### 自定义数字选择（X局Y定）

- 两个滑动选择器：局（2-9，中文数字）+ 定（2~X，中文数字），左右滑动吸附选中
- 约束 **Y ≤ X**：局选 X 时，定的可用区间实时收窄到 [2, X]，越界数字置灰
- 数字条随时可滑动，但必须按下"自定义"按钮才生效；与预设按钮不联动

### 对局算法

- **X局Y定**：最多 X 局，先出现 Y 个同面（yes/no）即定局；局间每局独立抛硬币
- **加赛**：打满 X 局仍一半一半（未达 Y 同面）→ 浮窗提示"平局！加赛一局定胜负" → 加赛一局直接定生死（该局结果即最终决策）
- **一局定输赢**：单次抛硬币，落定即终局

### 硬币交互与动画

- 硬币三面：展示面（主题图，无字）/ yes 面 / no 面；静止时展示面朝上（注：现实现已改双面）
- 左右滑动启动旋转，多次滑动叠加加速；以屏幕中线为轴左右翻转（rotateY 3D）
- 停止滑动开始计时，超过滑动允许时间（默认 3s，可配置）→ 小浮窗提醒"是决定的时候了" → 自动减速动画落定（yes 或 no 面朝上）
- 落定后带动画翻转回展示面，等待下一局

### 结果展示

- 硬币下方结果展示区：每局落定显示"第 X 局：YES/NO"（覆盖旧文字）+ 局进度指示
- 终局后结果区显示最终答案 + 出现重置按钮（仅终局出现），点击整轮归零重来
- 成绩按钮：浮窗（不遮页面）记录本轮全部局结果，会话内有效

## 四、目标项目结构

```text
fortune-choice/
├── index.html              # 入口：挂载 UI + 引入模块（模式区/硬币区/结果区/浮层）
├── package.json            # node ESM 声明（type: module）
├── css/coin.css            # 硬币 3D / 模式按钮 / 数字选择器 / 浮窗 / 单屏布局
├── js/
│   ├── random.js           # 可复现随机源（mulberry32 + seed 管理 + deriveSeed）
│   ├── rules.js            # 规则契约（模式枚举 / 局数范围 / 滑动参数 / 主题定义）
│   ├── game.js             # 对局状态机（X局Y定 / 加赛 / 一局定输赢 / 结果判定）
│   ├── coin.js             # 硬币 3D 动画封装（旋转 / 减速 / 翻转回展示面）
│   ├── ui.js               # DOM 构建 / 刷新 / 数字选择器 / 浮窗
│   └── main.js             # 启动装配与对局编排
├── config/
│   ├── rules.json          # 模式 / 局数范围 / 滑动允许时间 / 加减速 / 主题 / 动画参数
│   └── version.json        # 版本号单一来源（V0.1.0.0）
├── .temp/                  # 无头验证资产（gitignore）
├── .opencode/              # opencode 项目配置（skills）
├── AGENTS.md               # 项目说明（AI 工作约定）
├── README.md               # 项目说明
├── z.plan.md               # 本文件
└── x.progress.md           # 进度清单
```

## 五、无头验证（`.temp/verify_*`，不拉起浏览器）

- `verify_random.js`：随机源确定性 / 分布 / 派生 seed
- `verify_rules.js`：规则契约（模式枚举 / 局数约束 Y≤X / 滑动参数必填键）
- `verify_game.js`：对局状态机（X局Y定收敛 / 加赛触发 / 一局定输赢 / 终局判定 / 局进度）
- `verify_coin.js`：硬币动画纯计算部分（角度 / 减速参数，stub DOM）
- `run_all.py`：枚举执行全部 verify_* 统一出口汇总

## 六、部署（离线包）

- PC 上传（创作者中心 → Builder Hub）或移动端笔记挂载
- index.html + css/ + js/ + config/ 全内嵌、零外部 CDN、零禁用 API
- 纯前端改动无需客户端发版（新增/移除 JS API 除外）

---

## PL001. 幸运硬币选择完整 MVP 实施方案（2026-08-27）

> 来源：小红书小工具技术规范 + 与用户多轮对齐拍板（2026-08-27：模式互斥 / X局Y定 / 加赛定生死 / 硬币三面 2 套主题（注：现实现已改双面） / 滑动加速 3s 超时 / 结果区与终局重置 / 成绩会话内）
> 状态：✅ 已实施（V0.1.0.5，2026-08-28：双面硬币 + 落点引导精确落定 + 结果面停留翻转 + 交互打磨，首轮审计 A001 修复（定时器竞态/配置清理/交互优化/文档同步）全部落地；无头回归 6 脚本 + 2 探针全绿；浏览器端到端视觉已目检）
> 目标版本：V0.1.0.5

### 目标形态

| 区域     | 目标                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| 模式区   | 三局两定 / 五局三定 / 自定义（互斥可取消，无按钮 = 一局定输赢）                                  |
| 数字选择 | 双滑动选择器（局/定，1-9 中文），Y≤X 联动置灰，按"自定义"才生效，与预设不联动                    |
| 硬币     | 三面（展示面/yes/no），CSS3 3D 左右翻转，滑动加速，3s 超时提醒自动减速落定（注：现实现已改双面） |
| 对局     | X局Y定 + 加赛一局定生死 + 一局定输赢；结果区覆盖显示 + 局进度；终局重置按钮                      |
| 成绩     | 按钮浮窗记录本轮全部局结果（会话内有效）                                                         |
| 可复现   | seed 记录；同一 seed 同一结果                                                                    |

### 任务分解

- `PL001.1` 随机源 `js/random.js`（createRNG / next / int / deriveSeed）—— 验证：verify_random
- `PL001.2` 规则契约 `js/rules.js` + `config/rules.json`（模式枚举 / 局数范围 / 滑动参数 / 主题定义）—— 验证：verify_rules
- `PL001.3` 对局状态机 `js/game.js`（runGame / 加赛 / 终局判定 / 局进度）—— 验证：verify_game
- `PL001.4` 硬币动画 `js/coin.js`（3D 旋转 / 减速 / 翻转回展示面，纯计算 + stub DOM）—— 验证：verify_coin
- `PL001.5` 配置 `config/version.json`（版本号单一来源 V0.1.0.0）—— 验证：版本单点
- `PL001.6` UI `index.html` + `css/coin.css` + `js/ui.js` + `js/main.js`（模式区/数字选择器/硬币/结果区/浮窗）—— 验证：UI 单独（截图/手动）
- `PL001.7` 无头回归 `run_all.py` + 全量回归 —— 验证：全部 verify_* 0 失败
- `PL001.8` 文档同步（AGENTS.md 玩法描述更新 / README / 结构树）+ 版本号单点 —— 验证：版本三处一致

### 技术要点与硬限制

- 容器禁 WebGL / WASM / Workers / eval / new Function / document.write / 内联事件 / 外链 JS；依赖全内嵌离线包
- 硬币 3D 用 CSS3 `perspective + rotateY + preserve-3d`；动效只动 transform/opacity（守 WebView 渲染性能红线）
- 业务核心（random/rules/game）纯函数零 DOM 依赖 → 无头可测；coin 动画纯计算部分无头覆盖，表现层 UI 单独验证
- 结果先由 game 计算（落定 yes/no 为计算结果），动画只是表现不弄虚作假
- 边界：局数越界 / Y≤X 约束 / 空成绩 / 超时提醒 等 fail-fast 或明确回落，不崩溃（AGENTS.md 错误策略主线）
- seed 与 config 版本必须记录，保证可复现

### 工作量估算

| 部分          | 内容                             | 估算            |
| ------------- | -------------------------------- | --------------- |
| 核心逻辑      | PL001.1-3 随机/规则/对局状态机   | 半天            |
| 硬币动画      | PL001.4（3D 旋转 / 减速物理）    | 半天            |
| 界面与配置    | PL001.5-6 UI / 数字选择器 / 浮窗 | 半天            |
| 无头验证+收尾 | PL001.7-8                        | 2 小时          |
| 合计          |                                  | **约 1.5~2 天** |

### 已拍板决策（2026-08-27 记录在案）

1. **模式**：三局两定 / 五局三定 / 自定义三按钮互斥，再按取消；无按钮 = 一局定输赢
2. **自定义**：数字条随时可滑，按下"自定义"按钮才生效；与预设按钮不联动
3. **局数**：X ∈ [2,9]（中文数字），Y ∈ [2,X]，Y≤X 约束，越界置灰
4. **加赛**：打满 X 局一半一半 → 浮窗"平局！加赛一局定胜负" → 加赛一局直接定生死
5. **硬币**：三面（展示面 / yes / no），MVP 用 emoji 占位，2 套主题，设置按钮切换（注：现实现已改双面）
6. **滑动**：左右滑动启动、多次滑动叠加加速；停滑 3s（可配置）→ 小浮窗提醒 → 自动减速落定
7. **衔接**：每小局落定后结果区显示本局结果（覆盖旧文字）+ 局进度；硬币带动画翻转回展示面
8. **终局**：结果区显示最终答案 + 重置按钮（仅终局出现），点击整轮归零
9. **成绩**：浮窗记录本轮全部局结果，会话内有效（不持久化）
10. **版本**：V0.1.0.0（version.json 单点 + README 徽章 + x.progress 版本行 + z.plan 状态行同步）

---

## PL002. 硬币立体化：3D 圆柱侧面与滚花/齿环（2026-08-28 定案）

> 来源：与用户讨论（2026-08-28：双面卡片旋转无厚度感，真实硬币有滚花侧边）
> 状态：📌 待实施（PL002 任务清单见 x.progress.md）

### 背景

- 当前硬币为双面卡片（yes/no 两平面，backface-visibility hidden），旋转时像纸片翻转，无厚度感
- 真实硬币边缘为滚花（reeded edge），刻在侧面厚度上；正面外轮廓仍正圆
- 用户诉求：与真实硬币一致——侧面有厚度 + 滚花锯齿，正面外圈带齿环（插画风），两者都要

### 决策结论（2026-08-28 与用户确认）

1. **方案 A + B 都要**：CSS 3D 圆柱侧面（真厚度 + 侧面滚花）+ 正面外圈齿环（repeating-conic-gradient 装饰）
2. **侧面厚度 8~12px**，默认取 10px（走 :root 变量）
3. **接受 24~36 DOM 元素开销**：默认 24 片（弧长≈31px/片，D=240px）；低端机降 16 片或退化为仅齿环
4. **面保持中心原位**：圆柱壁做在面外圈（正面被面完全遮挡、旋转到侧面才露出），JS 旋转/落定逻辑零改动
5. **齿环不遮居中 emoji**：mask 保留外圈 68%~100% 半径环带
6. **参数走 css :root 变量**（--coin-thick/--coin-seg/--coin-rim-*）：纯视觉参数不入 config（沿用 --coin-size 先例）
7. **主题壁色由 theme.color 派生**（亮/暗），renderCoinTheme 同步，换主题壁跟着换

### 设计要点

- 结构：#coin 内新增 .coin-edge（preserve-3d）→ N 个 .edge-seg，`transform: rotateY(i×360/N) translateZ(R)`；每片宽=厚度 10px、高=弧长，直条近似圆筒
- 滚花：.edge-seg 背景 `repeating-linear-gradient` 竖条纹 + 金属渐变，旋转到侧面朝前时呈现齿纹
- 齿环：.face::after + `repeating-conic-gradient`（每 6° 一齿）+ `-webkit-mask: radial-gradient` 只留外圈
- 约束核查：纯 CSS3 3D + 渐变，无 eval/WebGL/Worker/外链；动效仍 transform（守性能红线）
- 涉及文件：css/coin.css、js/ui.js（buildCoinEdge + renderCoinTheme 同步壁色）、js/main.js（init 调用 buildCoinEdge）
- 不涉及：game.js/random.js/rules.js（纯逻辑零改动）

### 关联

- 版本：V0.1.0.3（2026-08-28 随 PL002/PL003 提交推进）
- 验证：无头探针断言 seg 数量与角度分布（.temp/verify_pl002_edge.js）+ 浏览器目检（侧面滚花 / 正面齿环 / 旋转流畅度）

---

## PL003. 硬币拟物化：写实金属质感（2026-08-28 定案）

> 来源：与用户讨论（2026-08-28：当前面片单色 + 单高光点，金属感缺失像贴纸；用户选择写实档）
> 状态：📌 待实施（PL003 任务清单见 x.progress.md）

### 背景

- 当前硬币面片 = 单一主题色 + 一个 `radial-gradient at 38% 32%` 高光点 + inset 底部阴影，无金属质感（贴纸/饼干感）
- 拟物化短板：无倒角边缘轮廓光、材质为单色（金/银各一色 + shadeHex 派生）、高光非各向异性、无表面肌理与压印、齿边与滚花缺过渡、无接触阴影
- 用户选择：写实档（全做）；missed 4（落定高光闪烁彩蛋）不做，记入 y.problem.md 待评估

### 决策结论（2026-08-28 与用户确认）

1. **写实档全做**：倒角轮廓光 / 金·银材质光谱 / 高光升级 / 肌理+浮雕 / 齿边斜纹+过渡环 / 接触阴影 + 动效侧 3 项（落定 bounce / 翻转手感 / prefers-reduced-motion）
2. **高光跟随问题选方案 A**：渐变绑定面片本地坐标，接受"光泽随表面游走"（等价环境贴图随物体）；不做 JS 逐帧平移高光（违反"动效只动 transform/opacity"性能红线）
3. **肌理用 SVG feTurbulence data-URI 静态贴图**：WebView 支持 SVG、旋转走 GPU transform 不重采样；emoji 浮雕用 drop-shadow 双层反向 1px 影（经典 emboss，需 feel-check backface-visibility Safari 坑）
4. **材质 palette**：THEMES 每主题新增 5 色 palette（hi/light/base/dark/deep），金暖银冷色相拉开；保留 color 字段兼容现有契约（verify_rules / renderCoinTheme）
5. **光影统一**：所有面高光方位一致（保持 38%32% 顶光体系）；倒角上弧亮下弧暗；侧面 seg 亮顶暗底——三处同光源
6. **接触阴影独立固定层**：#coin-stage 下椭圆软影，不随 #coin rotateY 旋转
7. **动效 3 项**：落定 bounce（scale 0.97→1，约 150ms，纯表现不改变结果角）；翻转回展示面改 ease-in-out + 轻微 overshoot（去推走感）；`@media (prefers-reduced-motion: reduce)` 旋转快进到落定面保留透明度过渡
8. **不做**：高光闪烁彩蛋（→ y.problem.md 📌 待评估）；JS 逐帧动高光（性能红线）

### 设计要点

- 面片：多层 radial-gradient 叠出金属圆盘（左上椭圆光带 + 主色曲率明暗 + 右下环境反光 + 边缘径向暗晕）+ conic 倒角环（上亮下暗，mask 成圆环）
- 倒角：面外圈环形渐变，与侧面 seg 顶部亮边衔接，形成"圆碟"轮廓
- 肌理：SVG turbulence data-URI 作 background-image（低透明度叠加，静态一次合成）
- 齿环：repeating-conic-gradient 保留 144 齿，mask 外圈留 2-3% 亮边过渡；侧面滚花条纹 90°→75° 斜齿（reeded edge 斜度）
- 动效：frame 落定后加 150ms scale 弹回；settle 翻转 transition 曲线改 ease-in-out + overshoot；reduced-motion 分支（结果快照直接展示落定面）
- 约束核查：纯 CSS 渐变 + SVG 静态贴图 + filter（静态），无 WebGL/Worker/实时 filter 重算；动效仍只动 transform/opacity
- 涉及文件：css/coin.css、js/ui.js（面片/倒角/阴影渲染 + renderCoinTheme 取 palette）、js/rules.js（THEMES palette）
- 不涉及：game.js/random.js/coin.js（纯逻辑零改动）

### 关联

- 版本：V0.1.0.3（2026-08-28 随 PL002/PL003 提交推进）
- 验证：无头探针断言 palette 结构/渐变层/动效曲线/斜纹角度（.temp/verify_pl003_*）+ 浏览器目检（金/银质感、旋转光影、落定 bounce、翻转手感、reduced-motion）

---

## PL004. 硬币图片币面与 rim 结构（2026-08-28 定案）

> 来源：与用户讨论（2026-08-28：emoji 正式替换为币面图片；真实硬币齿边内侧有凸起内 rim 与压铸痕迹）
> 状态：📌 待实施（PL004 任务清单见 x.progress.md）

### 背景

- 当前币面主体为 emoji（.face-mark），拟物化后仍显卡通；用户提供 anya 主题三张币面图（assets/coins/anya/：yes.jpg 447² / no.jpeg 1000² / show.jpeg 512²，均为 JPEG）
- 真实硬币齿边内侧：一圈凸起的内 rim（保护环，顶光下上沿亮下沿暗）+ 内缘压铸痕迹（rim 与图案区之间的暗沟/压线）
- 用户确认：rim 凸起 + 内缘压线都做；图片先按现状 JPEG 接入（方形角由圆形面片裁剪），后续可换透明 PNG

### 决策结论（2026-08-28 与用户确认）

1. **新增第三套主题 anya**：THEMES 增 anya（faces 用图片路径），gold/silver emoji 主题保留；DEFAULT_THEME 不变
2. **图片作为币面主体层**：.face 内 .coin-face-img（全铺 + border-radius 50% 圆形裁剪，JPEG 方形角裁掉）；图片覆盖 rim 以内的图案区
3. **rim 凸起 + 内缘压线都做**：新增 .coin-rim 环带（mask 只留 68%~76% 环），环形渐变模拟凸起（上沿亮下沿暗）；内缘压线 = rim 内侧 76% 处一圈暗线（压铸痕迹过渡到图案区）
4. **金属层重排叠图上方**：现有面片金属渐变（高光/曲率/肌理）移入 .coin-shine 独立层（pointer-events none），叠在图片之上（光打在币面上）；face 背景简化
5. **层叠顺序**：.coin-shine（上）→ .coin-rim（含压线）→ .coin-face-img → ::after 齿环 → ::before 倒角（按遮挡关系实施时定）
6. **anya palette**：实施时从图片主色估定（金属层/rim 取色），写死于 THEMES；换图只换 assets 图片不改样式
7. **契约同步**：verify_rules 断言 THEMES keys.length===2 → 动态/3；_setFaceMark 判断值类型（emoji 走 span，路径走 img）

### 设计要点

- 结构：.face 内新增 .coin-face-img（JS 由 theme.faces 路径创建 img）、.coin-shine、.coin-rim 三层；伪元素 ::before/::after 仍归倒角/齿环
- rim：.coin-rim 背景渐变（上亮下暗模拟凸起）+ mask radial 只留 68%~76% 环带；压线在 rim 内缘 1px 暗环
- 图片接入：_setFaceMark 改造为按主题 faces 值分派（emoji→span / 路径→img src），renderCoinTheme 换图
- 约束核查：图片为离线包内资源（相对路径，随离线包打包）；纯 CSS 层叠，无实时滤镜
- 涉及文件：js/rules.js（THEMES anya + palette）、js/ui.js（_setFaceMark/renderCoinTheme）、css/coin.css（.coin-face-img/.coin-shine/.coin-rim）、.temp/verify_rules.js（主题数量断言）
- 不涉及：game.js/random.js/coin.js、index.html（无需改）

### 关联

- 版本：V0.1.0.4（2026-08-28 随 PL004 提交推进）
- 验证：无头探针断言 anya 主题结构/图层/rim mask（.temp/verify_pl004_*）+ 浏览器目检（图叠加金属质感、rim 凸起与压线、三图切换、旋转流畅）

---

## PL005：币面图片凹凸浮雕（Canvas 2D 预渲染浮雕贴图）

> 目标：把 anya 币面图片按明暗做成凹凸浮雕——亮=凸受光、暗=凹背光，增强币面立体感
> 方案：方案 A（用户选定）——亮度作高度场 → 相邻像素梯度求法线 → 固定光源点积 → 明暗叠加回原图颜色；一次性预渲染 + 缓存，无每帧重算；备选方案 B（SVG feDiffuseLighting）因 WebView 兼容性不稳放弃
> 实现：js/emboss.js 新模块——embossPixels 纯像素函数（node 可直测）+ embossImage DOM 包装（canvas→dataURL，同源同参缓存）；ui.js _setFaceMark 图片分派接入（onload 预渲染替换 src，失败降级保留原图）
> 参数：EMBOSS_DEFAULTS（size/strength/ambient/slope/lightX/lightY/lightZ/colorBlend）；默认值代码内，可调参数外置 config 待定
> 约束核查：Canvas2D 允许；无 eval/Worker；离线包内嵌；同源图片无跨域

- 状态：✅ 已实施（V0.1.0.5，2026-08-28：emboss.js + ui 接入 + verify_emboss 7/7，run_all 10/10，浏览器目检通过）
- 版本：V0.1.0.5（2026-08-28 随 PL005 提交推进）
- 验证：.temp/verify_emboss.js（光源方位明暗/灰阶/色相保留/环境光/平坡一致）+ 浏览器目检
- 备注：本次版本附带修复主题切换回调 box=null 崩溃（content 即 .theme-options）

---

## PL007. 界面信息层补全与视觉收敛（2026-11-07 定案）

> 来源：taste-skill UI 检测（lint 30 FAIL + inspect 3 FAIL/2 WARN，证据 .temp/taste-before/report.json；检测日期 2026-11-07，评审基于实测数值+源码走读，截图在 .temp/taste-before/ 供人工复核）
> 状态：✅ 已实施（V0.1.1.0，2026-11-07：verify_rules + verify_pl007_ui 全绿，inspect 复测 no-title/emoji 清零；任务清单见 x.progress.md）

### 背景

- 首屏无 h1 无产品名，全页仅 10 词，5 秒认知测试不过（inspect: no-title FAIL；挂小红书笔记用户点进来第一眼不知是什么）
- 币面/成绩/结果 emoji 依赖（rules.js THEMES faces 的 🪙✅❌👍👎 + ui.js:378），待机主视觉为 114px 系统字体 emoji，跨机型渲染不一且质感廉价
- 多局进行中无比分可视：renderProgress 非终局态从未调用（main.js settle 只更新 round-result），三局两定打完第 2 局无处看当前比分
- 强调色 3 个（金 --accent / 绿 --accent-2 / 粉 --danger）超"一底一墨一强调"；结果揭晓 20px 弱于按钮存在感；待机态结果区 92px 空置（panel-void 实测 67px 空带）
- 桌面 1440 下 33% 空白（hero-void；主战场移动 WebView，PC 预览场景降权）；27 处硬币本体渐变被 lint 机械判 FAIL（实为 PL002-004 材质体系，有意保留）

### 决策结论（2026-11-07 与用户确认）

1. **顶部加 h1 标题行（常驻小标题）**：「幸运硬币」+ 副题"抛硬币，替你做决定"，常驻显示不淡出（用户拍板：常驻小标题方案，不占硬币区空间）
2. **比分进度条**：硬币区下方（结果区上方）；圆点形态——yes 计数金色实点、no 计数银灰实点、剩余局空心点 + "先取 N 局获胜"文案；数据全从 game 快照读（results 计数/totalRounds/overtime）；加赛态显示"加赛 · 一局定胜负"；one-shot 模式隐藏（无多局语义）
3. **去 emoji 化（用户拍板：YES / NO）**：gold/silver 主题币面文字标记——show 面「运」字作品牌标记、yes 面「YES」、no 面「NO」（沿用 .face-mark 浮雕 drop-shadow 体系，字号按 --coin-size 比例适配；「运」字形态实施时目检定稿）；成绩列表 ✅❌ → 金/银圆点 + YES/NO 文字；anya 图片主题不动
4. **重置按钮墨色（用户拍板）**：#reset-btn 背景从 --accent-2 绿改墨色填充（--text 系深底浅字）；--accent-2/--danger 从常驻 chrome 退役，降级为语义色（仅未来成功/失败时刻使用）
5. **结果揭晓强化**：#round-result 20px → 32px 级 + 落定 scale 弹入（动效只动 transform/opacity，参考 kinetics 弹簧配方参数）；终局答案更大或取金色
6. **待机态引导**：结果区待机显示当前模式说明（one-shot："抛一次 · 立刻定"；三局两定："三局两定 · 先取 2 局获胜"；五局三定/自定义同理），settle 覆盖、resetGame 复位——消解 92px 空置
7. **桌面约束**：#app max-width 480px 居中（背景保持夜色满屏），消解 1440 hero-void
8. **lint 标注**：硬币本体渐变相关规则块加 `/* taste-skill-ignore */`（语义标注"有意保留的材质渲染"，不删 PL002-004 成果）
9. **不做项**：不引入 GSAP（现有 rAF + CSS transition 体系够用，避免内嵌 ~70KB 依赖；后续动效复杂化再评估）；高光闪烁彩蛋沿 y.problem.md 待评估；不换字体（system-ui 体系保持，离线包零网络字体）

### 设计要点

- 标题行：index.html #mode-area 上方新增 header（h1 + p 副题），css 小号排（h1 约 20px/600、副题 13px/--text-dim），单屏布局 #app flex 首行 flex:0 0 auto
- 比分条：ui.js 新增 `renderScoreProgress(el, game)` 纯渲染函数（DOM stub 可测）；main.js settle 非终局分支落定后更新、resetGame 复位隐藏；圆点用 css 类（金实/银实/空心），文案由模式与 game 快照推导（"先取 Y 局获胜"取自 cfg.y）
- 币面文字：rules.js THEMES gold/silver faces 值改「运/YES/NO」（契约层同步：verify_rules 三面键断言不再绑 emoji 字符）；ui.js _setFaceMark 文字路径字号适配（emoji 字号 calc 沿用，字体走 system-ui 粗体 + letter-spacing）
- 色收敛：css/coin.css #reset-btn 配色改墨色；grep 断言 accent-2/danger 无常驻 chrome 引用
- 约束核查：纯 CSS3 + DOM，无新增依赖无网络资源；动效只动 transform/opacity；触区 ≥44px 不回退；零 emoji 后跨机型渲染一致性提升
- 涉及文件：index.html、css/coin.css、js/ui.js、js/main.js、js/rules.js、.temp/verify_rules.js（契约同步）
- 不涉及：game.js/random.js/coin.js/emboss.js（比分数据从 game 快照读，纯逻辑零改动）

### 关联

- 版本：V0.1.1.0（2026-11-07 随 PL007 提交推进；次版本位升级=界面功能级变更；跳过 PL006 编号——AGENTS.md 操作教训已引用 PL006 语义，避免歧义）
- 验证：.temp/verify_pl007_ui.js（DOM stub：h1/待机文案/比分各形态/零 emoji/按钮色）+ taste-skill inspect.mjs --app 复测（no-title/emoji/hero-void/panel-void 清零，渐变转 ignore 后 lint 归零）+ run_all 全量 + 浏览器目检（390 主档 + 320/430/1440）

---

## 附录 A001：全量代码审计报告（第1轮，2026-08-28）

> 范围：根级文档（AGENTS.md/README.md/z.plan.md/x.progress.md）+ index.html + js/_.js + css/coin.css + config/_.json；未审 .temp/.reference/.git
> 方式：全量通读 + 死代码 grep + 禁用 API 反向 grep + 文档一致性比对；仅只读，未改代码
> 状态：✅ 已修复（2026-08-28：A 系列任务全部完成，run_all 6/6 + 2 probe + 反向验收全绿；详见 x.progress.md A 系列）

### 零、上轮修复复核清单

无上轮（本仓库首次全量审计）。

### 一、P0-P3 修复清单

| #     | 文件:行号                                                             | 类型            | 描述                                                                                                                                                                                                                                                                                            | 建议                                                           | 性质 | 影响面            |
| ----- | --------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---- | ----------------- |
| P2-1  | js/main.js:217,237,247（settle）                                      | 8 并发与锁纪律  | 定时器未清理竞态：settle 三层 setTimeout（400ms/resultHoldMs/resetFlipMs）句柄未存 ctx；非终局落定后 400ms 内切换模式触发 resetGame，score 清空后旧定时器仍 push 旧局成绩污染新局，且 2000/1400ms 后旧翻转回调给新局硬币 angle+=180 并注入 transition；resetGame 未 clearTimeout(ctx.idleTimer) | 定时器句柄存 ctx（settleId/holdId/flipId），resetGame 统一清理 | 新增 | UI 交互 / 对局    |
| P3-1  | README.md:49, :95                                                     | 6 文档一致性    | README 硬币"三面"表述失实：实现已改双面（cover 移除，index.html:49-50 仅 face-yes/no），README 特性"三面翻转"与结构注释"三面角"仍写三面                                                                                                                                                         | 改"双面（yes/no）"，coin.js 描述同步                           | 新增 | 文档              |
| P3-2  | js/coin.js:4-6, :96-97                                                | 6 规范违反      | coin.js 模块说明区失实："展示面为独立 cover（不参与旋转，旋转开始即消失）"实际 cover 已删除，展示面由硬币本体双面呈现                                                                                                                                                                           | 模块说明改写为双面模型（无 cover）                             | 新增 | 文档              |
| P3-3  | js/ui.js:5, :294, :9                                                  | 6 规范违反      | ui.js"coin.js 三面角"失实；import FACE_ANGLES 全文件零使用                                                                                                                                                                                                                                      | 说明改"双面角"，删除 FACE_ANGLES import                        | 新增 | 文档 / 死代码     |
| P3-4  | x.progress.md:69-70, :86-91, :14, :96                                 | 6 文档一致性    | 勾选状态失实：PL001.4.c/d/f 与 6.d/e/f/g/h/i 标 `[ ]` 未完成但均已实现；"5 个 verify_*"（:14）实际 4 个                                                                                                                                                                                         | 勾选已完成项；verify 数量改 4                                  | 新增 | 文档              |
| P3-5  | config/rules.json:12-13 + js/rules.js:26-39, :165-175, :200-201       | 12 配置卫生     | 配置死键 turns/flipMs：REQUIRED_KEYS 强制必填 + 校验 + 返回对象含，但 main.js 零消费（动画已由 resultHoldMs/resetFlipMs 接管，flipMs 语义重叠）                                                                                                                                                 | 从 REQUIRED_KEYS 移除并同步 config，或恢复消费（二选一）       | 新增 | 配置体系          |
| P3-6  | js/main.js:15-16；js/rules.js:19；css/coin.css:19；js/coin.js:50, :84 | 5 死代码        | 死 import/死导出：main.js import FACE_ANGLES/guidedVelocity 生产零调用；DEFAULT_MODE 零引用；--idle-hint-ms 定义无使用；guidedVelocity/faceAtAngle 仅 .temp verify 引用                                                                                                                         | 删除未用 import/导出/CSS 变量（测试专用导出评估保留）          | 新增 | 离线包 / 配置体系 |
| P3-7  | css/coin.css:446-448 vs js/ui.js:108                                  | 1 正确性        | 窄屏数字条吸附错位：JS itemW=44 硬编码 vs CSS @media 改 .slot-item 宽 40px；320-380px 设备选中项相对高亮带逐格偏移                                                                                                                                                                              | itemW 改从 DOM 实测或与 CSS 变量同源                           | 新增 | UI 交互           |
| P3-8  | css/coin.css:124 + js/main.js:300                                     | 1 正确性        | 拖动数字条跟手滞后：.slot-track 恒有 transform 220ms 过渡，setOffset（拖动逐帧改 transform）也套用 → 手指拖动滞后不跟手                                                                                                                                                                         | 拖动中临时禁 transition（setOffset 置 none，setIndex 恢复）    | 新增 | UI 交互           |
| P3-9  | README.md:55 + js/main.js:60-62                                       | 6/10 文档一致性 | "结果可复现"承诺用户不可见：makeSeed 随机生成且无 UI/日志暴露 seed（game.seed 存快照但界面零暴露）                                                                                                                                                                                              | 结果区/日志暴露 seed（如 #seed= URL 回读）                     | 新增 | 文档 / 可观测性   |
| P3-10 | js/main.js:209, :252                                                  | 5 死代码        | settle 400ms 硬编码过渡：引导已精确落定 diff=0，恒 400ms 无可见动画仅延迟结果展示                                                                                                                                                                                                               | 简化，去掉无效过渡/延迟                                        | 提升 | UI 交互           |
| P3-11 | js/main.js:222                                                        | 5 死代码        | score.push 冗余三元：ctx.pending 已置 null 恒取后者                                                                                                                                                                                                                                             | 简化表达式                                                     | 提升 | 对局              |
| P3-12 | js/main.js:409                                                        | 7 安全          | init 错误条 String(e.message) 插入 innerHTML，配置内容含 HTML 标签可注入（理论，需验证）                                                                                                                                                                                                        | 改 createElement+textContent                                   | 提升 | 离线包            |
| P3-13 | index.html:38                                                         | 6 规范违反      | #slot-y 缺 aria-valuemin/max（slot-x 有）                                                                                                                                                                                                                                                       | 补齐 aria                                                      | 提升 | UI 交互           |
| P3-14 | z.plan.md:20,51,105,115,156；x.progress.md:34                         | 6 文档一致性    | 历史"三面"快照与现双面实现不符                                                                                                                                                                                                                                                                  | 相关历史条目加注（现实现已改双面）                             | 提升 | 文档              |

> 标注"提升"：原参考级观察项，经用户逐条评估（2026-08-28）提升为 P3。

### 二、参考级观察项

无——本轮 5 条观察项经用户逐条评估全部提升为 P3-10~P3-14。

### 三、亮点

- 契约层键名代码内声明（REQUIRED_KEYS/THEMES/MODES 单一权威），P23 契约定案合规
- 业务核心纯函数零 DOM（random/rules/game/coin 数值内核），无头可测；落点引导 guidedStep 被 verify 驱动断言精确落定（角度差 0）
- 禁用 API 全项目 grep 清零（仅 addEventListener）；错误策略统一中文 fail-fast + 启动降级不崩溃
- 版本单点 + 四处同步（V0.1.0.1）；toss 先算结果、动画只做表现不弄虚作假
