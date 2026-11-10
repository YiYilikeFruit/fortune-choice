# 开发进度追踪（x.progress.md）

> 依据：`z.plan.md`（幸运硬币选择方案报告，PL001）
> 当前版本：V0.1.3.1（单一来源：`config/version.json`；AGENTS.md「版本号唯一来源」约定）
> 记录格式：状态 [⏳ 待开发, ✅ 已完成] / 优先级 [高, 中, 低]
> 执行原则：每阶段完成后运行验证命令确认无回归，再进入下一阶段
> 错误策略：不崩溃、不阻塞、有提示、能自愈——统一中文错误类型 / fail-fast 与明确回落并用 / 宽容解析（详见 AGENTS.md 错误策略主线）

---

## 阶段验证命令速查（AGENTS.md 运行与验证）

```shell
# 无头回归总入口（枚举 .temp/verify_*.js 全量）
python3 .temp/run_all.py          # 全量回归
node .temp/verify_rules.js        # 规则契约：模式枚举 / Y≤X / 必填键 / 主题结构（PL001.2 重建）
node .temp/verify_pl007_ui.js     # PL007 UI：标题行 / 待机文案 / 比分形态 / 零 emoji / 样式关键值
```

---

## 已完成

---

## 未完成

### PL001 幸运硬币选择完整 MVP 实施（依据 z.plan.md PL001 方案，2026-08-27 规划）

> 目标：模式互斥（三局两定/五局三定/自定义/一局定输赢）+ 3D 硬币滑动加速 + X局Y定收敛 + 加赛一局定生死 + 结果区与终局重置 + 成绩/设置浮窗 + seed 可复现 + 无头验证，纯 HTML5 单页应用（离线包整目录上传 Builder Hub）
> 已拍板（2026-08-27）：模式三按钮互斥可取消（无按钮=一局定输赢）/ 数字条随时可滑按下"自定义"才生效且与预设不联动 / X∈[2,9]、Y∈[2,X] 且 Y≤X / 打满一半一半加赛一局定生死 / 硬币三面（展示面/yes/no，注：现实现已改双面）MVP emoji 2 套主题 / 停滑 3s 超时小浮窗提醒自动减速落定 / 每小局结果覆盖显示+局进度、硬币带翻转动画回展示面 / 终局最终答案+重置按钮（仅终局出现）/ 成绩浮窗会话内记录全部局结果 / 版本 V0.1.0.0
> 硬限制：沿用 PL001——禁 WebGL/WASM/Workers/eval/new Function/document.write/内联事件/外链 JS；依赖全内嵌离线包；业务核心（random/rules/game）纯函数零 DOM 依赖无头可测；动效只动 transform/opacity（CSS3 3D：perspective+rotateY+preserve-3d，守 WebView 渲染性能红线）；结果先由 game 计算，动画只是表现不弄虚作假
> 版本归属：V0.1.0.0（PL001.8 定版同步）
> 估算：核心逻辑 PL001.1-3 半天 / 硬币动画 PL001.4 半天 / 界面与配置 PL001.5-6 半天 / 验证收尾 PL001.7-8 约 2 小时

#### PL001.1 随机源（js/random.js）

- [x] PL001.1.a mulberry32 核心 + seed 归一化：数字/字符串 seed 经哈希归一为 uint32 内部态，`createRNG(seed)` 工厂返回相互独立的 RNG 实例——做法：random.js 实现 mulberry32 + normalizeSeed；验证：verify_random 同 seed 两实例序列逐位相等、异 seed 序列不同（不写死具体值，只断不变量）
- [x] PL001.1.b `next()` ∈ [0,1) 与 `int(min, max)` 均匀整数 API（含端点口径 `#` 注释说明）——做法：int 用 next() 区间映射，注释说明精度取舍；验证：verify_random int 落域正确（min/max 边界可达）
- [x] PL001.1.c 派生 seed 序列：`deriveSeed(baseSeed, key)` 按局/加赛等场景派生独立随机流，互不污染——做法：deriveSeed 拼接 key 再归一；验证：verify_random 派生序列确定且不同 key 互异
- [x] PL001.1.d verify_random.js 落地 `.temp/`（node 直跑不拉浏览器）：同 seed 同序列 / 异 seed 异序列 / [0,1) 分布粗均匀（桶计数偏离阈值内）/ int 落域四断言组——验证：node verify_random 0 失败；根 package.json type=module 支撑 node ESM

#### PL001.2 规则契约（js/rules.js + config/rules.json）

- [x] PL001.2.a 模式枚举 `MODES`：one-shot（一局定输赢）/ three-two（三局两定）/ five-three（五局三定）/ custom（自定义）冻结声明 + 默认模式 one-shot——做法：rules.js 模块级常量 Object.freeze；验证：verify_rules 枚举齐全、默认模式断言
- [x] PL001.2.b 局数契约：`validateGameConfig({x, y})` 校验 X∈[2,9] 整数、Y∈[2,X]、Y≤X，越界 fail-fast 中文错误——做法：纯函数校验，错误消息带具体值定位；验证：verify_rules 越界/非整数/Y>X 各路抛错断言
- [x] PL001.2.c 滑动/动画参数契约：idleTimeoutMs（默认 3000）/ 加速系数 / 减速时长 / 圈数 / 翻转时长等必填键，缺键导入期报错——做法：rules.js 参数键显式声明 + 导入期校验（对齐 P23 契约层：键名代码内声明不外置）；验证：verify_rules 缺键/坏值拦截断言
- [x] PL001.2.d 主题定义 `THEMES`：2 套主题（如 `gold`/`silver`），每套含展示面/yes 面/no 面 emoji 与配色——做法：THEMES 冻结声明，MVP 用 emoji 占位；验证：verify_rules 每套三面键齐全、默认主题断言
- [x] PL001.2.e verify_rules.js 落地：模式枚举 / Y≤X 约束 / 参数缺键 / 主题结构四组——验证：node verify_rules 0 失败

#### PL001.3 对局状态机（js/game.js）

- [x] PL001.3.a 状态定义 + `createGame(config, seed)`：状态枚举 idle/rotating/settling/settled/finished，返回不可变状态快照——做法：game.js 纯函数状态机，状态转移返回新对象不原地突变；验证：verify_game 状态转移序列断言
- [x] PL001.3.b 单局抛硬币 `toss(game)`：按当前局次 deriveSeed 派生随机流，出 yes/no——做法：int(0,1) 映射 yes/no，记录到结果列表；验证：verify_game 同 seed 同结果、结果记录追加
- [x] PL001.3.c X局Y定收敛判定：统计已出 yes/no 计数，先达 Y 个同面 → 状态 finished 且最终决策=该面——做法：`checkFinished(results, {x, y})` 纯函数；验证：verify_game 构造各计数形态断言定局面与终局态
- [x] PL001.3.d 加赛逻辑：打满 X 局仍一半一半（双方计数均 < Y 且局数已到 X）→ 触发加赛（浮窗提示由 UI 层），加赛一局直接定生死（该局结果即最终决策）——做法：`needOvertime(results, cfg)` 纯函数判定 + 加赛局为最终局；验证：verify_game 一半一半构造触发加赛、加赛局结果=最终决策
- [x] PL001.3.e 一局定输赢模式：one-shot 模式 toss 一次即 finished，结果即最终决策——做法：按模式分支；验证：verify_game one-shot 单局即终局
- [x] PL001.3.f 局进度与结果记录：返回 {results: [yes/no...], currentRound, totalRounds, finished, decision, overtime}——做法：快照字段齐全；验证：verify_game 各模式快照字段断言（不写死具体局数，只断不变量）
- [x] PL001.3.g 边界：X/Y 越界 fail-fast 中文错误 / 空结果 / 加赛前结果不可再追加（已 finished 拒绝 toss）——验证：verify_game 三边界断言
- [x] PL001.3.h verify_game.js 落地：收敛 / 加赛 / one-shot / 快照 / 边界五组——验证：node verify_game 0 失败

#### PL001.4 硬币 3D 动画（js/coin.js）

- [x] PL001.4.a 三面 DOM 结构 + CSS 3D：展示面/yes/no 三面卡片，`perspective + rotateY + preserve-3d`，展示面为初始朝向——做法：coin.js 构建面容器，css/coin.css 3D 变换；验证：probe DOM stub 三面存在、初始朝向断言
- [x] PL001.4.b 旋转速度模型：`tick(dt, velocity)` 速度衰减曲线（滑动累加速度，停滑后线性/指数衰减）+ 减速时长参数走 rules——做法：纯函数速度模型，参数外置不硬编码；验证：verify_coin 速度衰减单调、参数生效断言
- [x] PL001.4.c 滑动事件：touchstart/move/end 识别左右滑动，启动旋转；连续滑动叠加速度——做法：ui.js 绑定事件 → coin 速度累加，防误触（阈值判定）；验证：probe_pl001_ui 滑动事件行为断言
- [x] PL001.4.d 超时提醒：停滑开始计时，超过 idleTimeoutMs → 触发"是决定的时候了"小浮窗（UI 层）并开始减速——做法：计时器状态 + 回调；验证：probe_pl001_ui 计时触发断言
- [x] PL001.4.e 减速落定：累计角 → 终面朝向计算（初始角 + 累计旋转角 → 模 360 判定 yes/no 面朝上），落定结果 = game 计算结果（不弄虚作假）——做法：`finalFace(angle, gameDecision)` 纯函数，动画终态对齐计算结果；验证：verify_coin 终面角与计算结果一致断言
- [x] PL001.4.f 翻转回展示面动画：落定后带动画 rotateY 回 0 度（展示面朝上），供下一局——做法：翻转动画 transform 过渡；验证：probe_pl001_ui 翻转回调断言
- [x] PL001.4.g verify_coin.js 落地（纯计算部分 + stub DOM）：速度衰减 / 终面角 / 三面结构——验证：node verify_coin 0 失败

#### PL001.5 配置落地（config/version.json + config/rules.json）

- [x] PL001.5.a config/version.json：版本号单一来源 V0.1.0.0（项目声明唯一字段，一处单点导出全项目共引）——验证：grep 断言版本字面值全项目仅一处定义
- [x] PL001.5.b config/rules.json 落地：默认模式 / 局数范围 / idleTimeoutMs / 加减速参数 / 动画时长 / 2 套主题——验证：经 rules.js 契约校验（verify_rules 加载真实文件）
- [x] PL001.5.c 配置加载与契约：main.js 装配层一次性加载传递（核心层运行时零 IO），坏 JSON fail-fast 中文提示不静默——验证：probe 坏 JSON 输入断言

#### PL001.6 UI（index.html + css/coin.css + js/ui.js + js/main.js）

- [x] PL001.6.a index.html 入口：模式区 / 数字选择器 / 硬币区 / 结果展示区 / 成绩按钮 / 设置按钮 / 浮层容器区块挂载；零内联事件（addEventListener 统一绑定）——验证：grep 断言零 onclick/onload 等内联 handler
- [x] PL001.6.b 模式按钮互斥：三局两定/五局三定/自定义三按钮按下态高亮，再按取消，至多一个按下；无按钮 = 一局定输赢——做法：ui.js 按钮状态机 + css 按下态；验证：probe_pl001_ui 互斥/取消/默认态断言
- [x] PL001.6.c 数字滑动选择器：局/定两个横向滑动数字条（1-9 中文数字），左右滑动吸附最近数字，选中放大弹跳 + 高亮带；局变化时定可用区间实时收窄 [2,X]，越界置灰——做法：ui.js 滑动选择器 + css 动画；验证：probe_pl001_ui 吸附/联动/置灰断言
- [x] PL001.6.d 硬币渲染：双面（yes/no）渲染 + 待机展示面（双面均显主题图），2 套主题 emoji 经设置切换，初始展示面朝上——做法：ui.js renderCoinTheme/setCoinShowFace + coin.js 动画配合；验证：probe_pl001_ui 双面渲染/主题切换断言
- [x] PL001.6.e 结果展示区（部分：覆盖显示已实现，局进度指示待补）：每局落定显示"第 X 局：YES/NO"（覆盖旧文字）；终局显示最终答案 + 重置按钮（仅终局出现）——做法：ui.js 结果区渲染 + 状态驱动；验证：probe_pl001_ui 覆盖显示/终局按钮出现断言
- [x] PL001.6.f 成绩浮窗：点击成绩按钮浮出不遮页面浮窗，列表记录本轮全部局结果（会话内有效）——做法：浮窗组件，只读渲染；验证：probe_pl001_ui 浮窗内容断言
- [x] PL001.6.g 设置浮窗：点击设置按钮浮出，切换硬币主题（2 套）——做法：浮窗组件 + 主题切换回调；验证：probe_pl001_ui 切换生效断言
- [x] PL001.6.h 单屏自适应：强制单屏（100dvh + overflow hidden），硬币区 flex 吸收剩余，320/375/430 断点，`env(safe-area-inset-_)` 全覆盖，点击区 ≥44px——做法：css/coin.css 布局 + :root 变量；验证：浏览器 eval 无滚动断言 + 多档目检
- [x] PL001.6.i main.js 启动装配：加载配置 → createGame → 对局编排（滑动→旋转→超时→落定→结果→下一局/终局）→ 错误入口统一提示不崩溃（降级不中断）——做法：main.js 装配层；验证：浏览器冒烟（agent-browser 端到端一局/多局/加赛/重置全链路）

#### PL001.7 无头回归编排（.temp/run_all.py）

- [x] PL001.7.a run*all.py：枚举执行全部 verify*\*（node 子进程）统一出口计数汇总，任一失败非零退出——做法：参考参考项目 run_all.py 写法；验证：注入临时失败脚本断言非零退出
- [x] PL001.7.b 全量回归 = 全部 verify\_\* 0 失败；校验**不变量**为主，禁止写死易变值（A018 验证纪律：版本/日期/路径/计数不写死，用正则/动态读取）——验证：run_all.py 0 失败（4 脚本全绿）

#### PL001.8 文档同步与版本定版

- [x] PL001.8.a AGENTS.md 玩法描述更新：单局 yes/no → 多局模式（三局两定/五局三定/自定义 X局Y定/一局定输赢 + 加赛）——做法：AGENTS.md 开头描述段落与相关约定同步；验证：文档与定稿玩法比对
- [x] PL001.8.b README 更新：简介 / 特性 / 使用说明 / 项目结构树 / 徽章与玩法描述同步——做法：README 全面更新；验证：文档与代码实况比对
- [x] PL001.8.c 版本 V0.1.0.0 四处同步：version.json / README 徽章 / x.progress 版本行 / z.plan 状态行——做法：单点改 version.json，其余同步；验证：四处动态读取比对一致 + 四段式正则 `V\d+\.\d+\.\d+\.\d+`
- [x] PL001.8.d 离线包完整性核查：index.html + css/ + js/ + config/ 全内嵌、零外部 CDN 外链、零禁用 API（WebGL/Workers/eval/new Function/document.write/内联事件 grep 清零）——验证：grep 反向断言
- [x] PL001.8.e commit 草稿按 V2 规范给出（git add 清单 + message，形如 `feat: V0.1.0.0，丢硬币多局玩法与 3D 硬币交互...`），AI 不执行 git 写操作——验证：草稿经用户审阅后由用户执行

---

## A. 第1轮审计修复任务清单（依据 z.plan.md 附录 A001，2026-08-28）

> 状态：✅ 已完成（2026-08-28：A2-A4 全部完成，run_all 6/6 + 2 probe + verify_a_fixes 29/29 + verify_a_accept 5/5 全绿）；优先级：A2（P2 并发）→ A3（P3 清理）→ A4（验证收尾）
> 报告：z.plan.md 附录 A001（编号 A001，经用户确认）；观察项 5 条经逐条评估全部提升为 P3-10~P3-14

#### A2 P2 级修复

- [x] A2.1 定时器竞态清理 —— js/main.js settle 三层定时器句柄入 ctx（holdId/flipId）+ resetGame 统一 clearTimeout（含 idleTimer）；验证：verify_a_fixes 句柄断言 + 反向验收 5/5（2026-08-28）

#### A3 P3 级修复

- [x] A3.1 README 三面改双面 —— README.md 特性"双面翻转"、结构注释"双面角"、rules.json 注释"落点引导/结果停留"；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.2 coin.js 模块说明改写 —— js/coin.js 头部/尾部说明与 FACE_ANGLES/异常注释删 cover 描述，改"展示面由硬币本体双面呈现"；验证：rg cover 清零（2026-08-28）
- [x] A3.3 ui.js 说明与死 import —— js/ui.js 说明改"双面角"、删 FACE_ANGLES import；验证：node --check（2026-08-28）
- [x] A3.4 x.progress 勾选修正 —— PL001.4.c/d/f、6.d/f/g/h/i 勾选 [x]（6.e 标注部分：覆盖显示已完成、局进度指示待补）；verify 数量改 4；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.5 turns/flipMs 配置死键 —— rules.js REQUIRED_KEYS/validateRules/return 移除、config/rules.json 删两键、verify_rules 同步；验证：verify_rules 54/54 + verify_a_accept 真实 config 不阻塞（2026-08-28）
- [x] A3.6 死代码清理 —— main.js/ui.js 删死 import（guidedVelocity/FACE_ANGLES）、css 删 --idle-hint-ms；DEFAULT_MODE/guidedVelocity/faceAtAngle 保留（verify 测试契约）；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.7 窄屏 slot 吸附 —— ui.js buildSlot itemW 改 items[0].offsetWidth 实测（fallback 44）；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.8 拖动 transition 滞后 —— ui.js setOffset 禁 transition（跟手）、setIndex 恢复；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.9 seed 可复现可见性 —— main.js settle 终局 renderProgress 展示 `seed: ${ctx.game.seed}`；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.10 settle 400ms 简化 —— main.js settle 删 Math.max(400,diff\*3) 过渡与 400ms 外层延迟（引导已精确落定）；验证：verify_a_fixes + verify_a_accept 收敛无回归（2026-08-28）
- [x] A3.11 score.push 冗余三元 —— main.js 终局分支简化为 ctx.game.decision；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.12 init 错误条防注入 —— main.js catch 改 createElement+textContent；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.13 slot-y aria 补齐 —— index.html #slot-y 加 aria-valuemin="2" aria-valuemax="9"；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.14 历史三面快照加注 —— z.plan.md 5 处 + x.progress.md:34 补"（注：现实现已改双面）"；验证：verify_a_fixes 断言（2026-08-28）

#### A4 验证与收尾

- [x] A4.1 全量回归 —— run_all 6/6（含 verify_a_fixes）+ probe 2 个 + verify_a_accept 5/5 + 冒烟 import 全模块 OK；验证：0 失败（2026-08-28）
- [x] A4.2 commit 草稿 —— git add 清单 + message（feat: V0.1.0.1 含审计修复）；验证：用户审阅

---

## PL002. 硬币立体化任务清单（依据 z.plan.md PL002，2026-08-28）

> 状态：✅ 已实施（2026-08-28：PL002.1-3 全部落地，verify_pl002_edge 30/30 + 回归 7/7 + 冒烟 OK；浏览器目检待用户确认）；分组：PL002.1 css → PL002.2 ui.js → PL002.3 main.js → PL002.4 验证收尾
> 方案：z.plan.md PL002（圆柱侧面 + 正面齿环，8~12px 厚度，参数走 :root 变量）

#### PL002.1 CSS 圆柱壁与齿环样式

- [x] PL002.1.a :root 立体化参数 —— css/coin.css :root 新增 `--coin-thick: 10px` / `--coin-seg: 24` / `--coin-edge` / `--coin-rim-hi/lo`；验证：grep 断言（2026-08-28）
- [x] PL002.1.b .coin-edge/.edge-seg 圆柱壁 —— css/coin.css 新增壁容器（preserve-3d + pointer-events none）与 seg（宽=弧长/高=厚度由 JS 设，滚花 repeating-linear-gradient + 金属渐变）；验证：verify_pl002_edge 结构断言（2026-08-28）
- [x] PL002.1.c .face::after 正面齿环 —— css/coin.css 齿环（repeating-conic-gradient 每 6° 一齿 + -webkit-mask radial 只留外圈 68%~100%，不遮居中 emoji）；验证：grep 断言（2026-08-28）

#### PL002.2 ui.js 渲染

- [x] PL002.2.a buildCoinEdge(coinEl, n, radius, thick) —— js/ui.js 新增函数生成 N 个 .edge-seg（transform `rotateY(i×360/N) translateZ(R)`，宽=弧长 2πR/N、高=thick），返回 seg 数组；验证：node 探针断言数量/角度/尺寸（2026-08-28）
- [x] PL002.2.b renderCoinTheme 同步壁色 —— js/ui.js renderCoinTheme 写 --coin-edge=主题色、--coin-rim-hi=主题色、--coin-rim-lo=shadeHex(色,0.62)（新增内部 shadeHex）；验证：probe_pl001_ui 主题切换（2026-08-28）

#### PL002.3 main.js 集成

- [x] PL002.3.a init 调用 buildCoinEdge —— js/main.js init 读 :root 变量（--coin-seg/--coin-size/--coin-thick）构建圆柱壁；resetGame 待机也 renderCoinTheme 同步壁色再覆盖展示面；验证：冒烟 import + verify_pl002_edge（2026-08-28）

#### PL002.4 验证与收尾

- [x] PL002.4.a 无头探针 .temp/verify_pl002_edge.js —— 断言 buildCoinEdge 生成 24 seg、角度均匀分布（每片 360/24）、translateZ=120、宽=弧长 31.4px、高=10px；验证：node 30/30 PASS（2026-08-28）
- [x] PL002.4.b 全量回归 + 目检 —— run_all 7/7 + 2 probe + verify_a_fixes/accept 全绿（2026-08-28 已跑）；**浏览器目检待用户确认**（侧面滚花 / 正面齿环 / 旋转流畅，低端机片数可调）；验证：用户刷新页面目检

---

## PL003. 硬币拟物化任务清单（依据 z.plan.md PL003，2026-08-28）

> 状态：✅ 已实施（2026-08-28：PL003.1-6 全部落地，verify_pl003 39/39 + 回归 8/8 + 冒烟 OK；浏览器目检待用户确认）；分组：PL003.1 rules.js palette → PL003.2 css 面片/倒角 → PL003.3 肌理/浮雕 → PL003.4 齿边/滚花 → PL003.5 接触阴影 → PL003.6 动效 → PL003.7 验证收尾
> 方案：z.plan.md PL003（写实金属质感：金/银材质光谱 + 高光/倒角/肌理 + 动效手感；高光跟随取方案 A 本地渐变）

#### PL003.1 材质 palette（rules.js）

- [x] PL003.1.a THEMES 新增 palette 字段 —— js/rules.js gold/silver 各加 5 色（hi/light/base/dark/deep，金暖银冷色相拉开），保留 color 兼容现有契约；验证：verify_pl003 断言 palette 结构 + color 仍存在（2026-08-28 39/39）

#### PL003.2 面片金属质感与倒角（css）

- [x] PL003.2.a 面片多层金属渐变 —— css/coin.css .face-yes/no 改多层 radial-gradient（左上椭圆光带 + 曲率明暗 + 右下环境反光 + 边缘暗晕，光源方位统一 38%32%）；验证：verify_pl003 断言渐变层 + 目检（2026-08-28）
- [x] PL003.2.b 倒角轮廓环 —— .face 外圈 conic 渐变（上弧亮下弧暗）+ mask 圆环，与侧面 seg 顶部亮边衔接；验证：verify_pl003 断言 ::before conic + mask 95%（2026-08-28）

#### PL003.3 肌理与浮雕（css）

- [x] PL003.3.a SVG turbulence 肌理贴图 —— .face 叠加 feTurbulence data-URI background（低透明度，静态一次合成，旋转不重采样）；验证：verify_pl003 断言 data-URI + 目检（2026-08-28）
- [x] PL003.3.b emoji 浮雕 —— 面 emoji 包 .face-mark span + drop-shadow 双层反向 1px（亮影下暗影上，emboss）；验证：verify_pl003 断言 drop-shadow + 目检（含 Safari backface-visibility feel-check）（2026-08-28）

#### PL003.4 齿边与滚花（css）

- [x] PL003.4.a 齿环亮边过渡 —— .face::after mask 外圈留 2-3% 亮边（齿与面之间过渡环）；验证：verify_pl003 断言 mask 68%~95%（2026-08-28）
- [x] PL003.4.b 侧面斜齿滚花 —— .edge-seg repeating-linear-gradient 90°→75° 斜条纹（reeded edge 斜度）；验证：verify_pl003 断言 75deg（2026-08-28）

#### PL003.5 接触阴影（css）

- [x] PL003.5.a 接触阴影层 —— #coin-stage 下加 .coin-shadow 椭圆软影（独立固定层，不随 rotateY 转）；验证：verify_pl003 断言 #coin-scene::after + 目检（2026-08-28）

#### PL003.6 动效手感（css/main.js）

- [x] PL003.6.a 落定 bounce —— frame 落定点后 150ms scale(0.97→1) 弹回（纯表现层不改变结果角，守 transform 红线）；验证：verify_pl003 断言 coin-bounce + 目检（2026-08-28）
- [x] PL003.6.b 翻转回展示面手感 —— settle 翻转 transition 改 ease-in-out + 轻微 overshoot（180°+ 弹回，去"被推走"感）；验证：verify_pl003 断言 cubic-bezier(0.34,1.4,0.4,1)（2026-08-28）
- [x] PL003.6.c prefers-reduced-motion —— css @media reduce 分支（关 coin 动画）+ main.js matchMedia 快进落定到结果面；验证：verify_pl003 断言 reduce 分支 + matchMedia（2026-08-28）

#### PL003.7 验证与收尾

- [x] PL003.7.a 无头探针 —— .temp/verify_pl003.js 断言 palette 结构/渐变层/动效曲线/斜纹角度；验证：node 39/39 PASS（2026-08-28）
- [x] PL003.7.b 全量回归 + 目检 —— run_all 8/8 + 2 probe + verify_a_fixes 全绿 + 冒烟 OK（2026-08-28 已跑）；**浏览器目检通过（用户确认：金/银质感、旋转光影、落定 bounce、翻转手感、reduced-motion）**；版本推进 V0.1.0.3 四处同步

---

## PL004. 硬币图片币面与 rim 结构任务清单（依据 z.plan.md PL004，2026-08-28）

> 状态：✅ 已实施（2026-08-28：PL004.1-3 全部落地，verify_pl004 21/21 + 回归 9/9 + 冒烟 OK；浏览器目检待用户确认）；分组：PL004.1 主题/图片接入 → PL004.2 rim/压线 → PL004.3 金属层重排 → PL004.4 验证收尾
> 方案：z.plan.md PL004（anya 图片币面 + rim 凸起 + 内缘压线，JPEG 现状接入）

#### PL004.1 主题与图片接入（rules.js/ui.js）

- [x] PL004.1.a THEMES 新增 anya —— js/rules.js 增第三套主题（faces: yes/no/show → assets/coins/anya/ 图片路径）+ palette（中性金棕系，目检可微调）；verify_rules 主题数量断言 2→动态；验证：verify_rules 60/60 + verify_pl004（2026-08-28）
- [x] PL004.1.b \_setFaceMark 图片分派 —— js/ui.js 按 faces 值类型分派（emoji→span.face-mark / 路径→img.coin-face-img），renderCoinTheme 换图；验证：verify_pl004 断言 img src + emoji 兼容（2026-08-28）

#### PL004.2 rim 凸起 + 内缘压线（css）

- [x] PL004.2.a .coin-rim 凸起环带 —— css/coin.css 新增环带（mask 60%~68%，conic 上亮下暗模拟凸起保护环）；验证：verify_pl004 mask 断言 + 目检（2026-08-28）
- [x] PL004.2.b 内缘压线 —— rim 内侧 60% 处 1px 暗环（压铸痕迹过渡图案区）；验证：verify_pl004 59.5%~60.5% 断言 + 目检（2026-08-28）

#### PL004.3 金属层重排（css）

- [x] PL004.3.a .coin-shine 独立层 —— 面片金属渐变（高光/曲率/肌理）移入 .coin-shine（inset 4% 半透明）叠图片上方，face 背景仅留曲率渐变；验证：verify_pl003 渐变断言同步 40/40 + 目检（2026-08-28）

#### PL004.4 验证与收尾

- [x] PL004.4.a 无头探针 —— .temp/verify_pl004.js 断言 anya 主题结构/图片资源在位/img 分派/rim mask；验证：node 21/21 PASS（2026-08-28）
- [x] PL004.4.b 全量回归 + 目检 —— run_all 9/9 + probe/verify_a_fixes 全绿 + 冒烟 OK（2026-08-28 已跑）；**浏览器目检通过（用户确认：anya 图叠加金属质感、rim 凸起与压线、交界线方位明暗与羽化）**；版本推进 V0.1.0.4 四处同步

### PL005 任务清单（2026-08-28 币面图片凹凸浮雕）

- [x] PL005.1 新建 js/emboss.js —— embossPixels 纯函数（灰度→高度场→梯度法线→光源点积）+ embossImage 包装（canvas→dataURL）+ 同源缓存；验证：verify_emboss 7/7
- [x] PL005.2 ui.js 图片分派接入 —— onload 预渲染替换 src，失败降级保留原图；验证：node --check + 浏览器冒烟
- [x] PL005.3 verify_emboss.js 探针 —— 光源方位明暗/灰阶/色相保留/环境光/平坡一致；验证：run_all 10/10
- [x] PL005.4 修复主题切换回调 box=null —— content 即 .theme-options，直接遍历子按钮；验证：浏览器点设置切换主题 OK（用户确认）
- [x] PL005.5 目检定稿 —— 用户确认浮雕效果 OK；参数默认暂存 EMBOSS_DEFAULTS，外置 config 待定

---

## PL007. 界面信息层补全与视觉收敛任务清单（依据 z.plan.md PL007，2026-11-07）

> 状态：✅ 已实施（V0.1.1.0，2026-11-07：verify_rules + verify_pl007_ui 全绿；inspect 复测 no-title/emoji 清零；lint 仅剩 gradient 27 处记录式豁免）
> 方案：z.plan.md PL007（taste-skill 检测驱动：标题/比分/去 emoji 化/色收敛/结果强化/桌面约束）
> 拍板（2026-11-07）：标题常驻小标题 / 币面 YES·NO（show 面「运」）/ 重置按钮墨色 / 版本 V0.1.1.0
> 硬限制：沿用 PL001——禁 WebGL/WASM/Workers/eval/外链 JS；依赖全内嵌；动效只动 transform/opacity；触区 ≥44px；零网络资源
> 版本归属：V0.1.1.0（PL007.6 定版同步）

#### PL007.1 标题行与待机引导（index.html + css/coin.css + js/main.js）

- [x] PL007.1.a h1 标题行常驻 —— 做法：index.html #mode-area 上方新增 header（h1「幸运硬币」+ 副题 p"抛硬币，替你做决定"），css 小号排（h1 约 20px/600、副题 13px/--text-dim），flex:0 0 auto 不挤压硬币区；验证：verify_pl007_ui DOM stub 断言 h1 存在、文案唯一、位于模式区之前；inspect 复测 no-title FAIL 清零
- [x] PL007.1.b 待机模式说明文案 —— 做法：结果区待机态渲染模式说明（one-shot"抛一次 · 立刻定"/三局两定"三局两定 · 先取 2 局获胜"/五局三定/自定义按 cfg 推导），settle 落定覆盖、resetGame 复位；验证：verify_pl007_ui 各模式待机文案断言 + panel-void 复测消解

#### PL007.2 比分进度条（js/ui.js + js/main.js + css/coin.css）

- [x] PL007.2.a renderScoreProgress 纯渲染 —— 做法：ui.js 新增 renderScoreProgress(el, game)：yes 计数金实点、no 计数银灰实点、剩余局空心点（css 类驱动）+ "先取 Y 局获胜"文案（Y 取自 game 配置）；数据全从 game 快照读，纯函数 DOM stub 可测；验证：verify_pl007_ui 构造 0:0/1:1/2:0/加赛各形态断言点数与文案
- [x] PL007.2.b main.js 接线 —— 做法：settle 非终局分支落定后调 renderScoreProgress 更新；resetGame 复位；one-shot 模式隐藏（无多局语义）；验证：verify_pl007_ui one-shot 隐藏断言 + 多局更新断言
- [x] PL007.2.c 加赛态文案 —— 做法：game.overtime 为真时比分条替换为"加赛 · 一局定胜负"（点数隐藏或保留由目检定）；验证：verify_pl007_ui 加赛形态断言

#### PL007.3 去 emoji 化（js/rules.js + js/ui.js + .temp/verify_rules.js）

- [x] PL007.3.a 币面文字标记 —— 做法：THEMES gold/silver faces 改 show「运」/yes「YES」/no「NO」（文字走 .face-mark 浮雕体系，字号按 --coin-size 比例、system-ui 粗体；「运」字实施时目检定稿）；anya 图片主题不动；verify_rules 三面键断言与 emoji 解绑（断键存在不断字符值）；验证：verify_rules 0 失败 + verify_pl007_ui 源码零硬编码 emoji 断言（grep index/css/js 清零）
- [x] PL007.3.b 成绩列表去 emoji —— 做法：ui.js buildScoreContent 的 ✅/❌ 改 css 圆点（金/银）+ YES/NO 文字；验证：verify_pl007_ui 成绩条目渲染断言（点类名 + 文字）

#### PL007.4 色收敛与结果强化（css/coin.css + js/ui.js）

- [x] PL007.4.a 重置按钮墨色 —— 做法：#reset-btn 背景 --accent-2 绿 → 墨色填充（深底浅字，对比度达标）；验证：verify_pl007_ui 样式断言（stub getComputedStyle 或类/值检查）+ 目检
- [x] PL007.4.b 结果揭晓强化 —— 做法：#round-result 20px → 32px 级、落定 scale 弹入（transform-only，参考 kinetics 弹簧参数，reduced-motion 关闭）；终局 .final 更大或金色；验证：目检戏剧感 + inspect 字号测量纳入
- [x] PL007.4.c 语义色降级 —— 做法：--accent-2/--danger 从常驻 chrome 退役（仅语义时刻保留定义）；验证：grep 断言 css/js 无 accent-2/danger 常驻 UI 引用

#### PL007.5 桌面约束与 lint 标注（css/coin.css）

- [x] PL007.5.a 桌面 max-width —— 做法：#app max-width 480px + margin 0 auto（背景夜色满屏），消解 1440 hero-void；验证：inspect 复测 1440 hero-void WARN 消除 + 390 主战场布局无回归
- [x] PL007.5.b 渐变 lint 标注 —— 做法：硬币本体渐变规则块（.face-yes/.face-no/.coin-shine/.coin-rim*/.coin-junction/.face::before/::after/.edge-seg/#coin-scene::after）加 /* taste-skill-ignore */ 语义标注；验证：lint 复测渐变 FAIL 清零（27 → 0）

#### PL007.6 验证收尾与版本定版

- [x] PL007.6.a verify_pl007_ui.js 落地 —— 做法：.temp/ DOM stub 汇总断言（h1/待机文案/比分形态/零 emoji/按钮色/成绩渲染）；验证：node 直跑 0 失败并纳入 run_all
- [x] PL007.6.b taste-skill 复测 —— 做法：lint.mjs --app + inspect.mjs --app 三档复测，对照 .temp/taste-before 基线；验证：no-title/emoji/hero-void/panel-void 清零、渐变转 ignore 后 lint 归零（WARN 可辩护项注明理由）
- [x] PL007.6.c run_all 全量回归 —— 做法：跑全部 verify_*（含新增 verify_pl007_ui）；验证：0 失败退出码 0（校验不变量为主，不写死易变值）
- [x] PL007.6.d 文档同步 —— 做法：README 界面描述同步（标题行/比分/YES·NO 币面/墨色按钮）；验证：文档与实况比对
- [x] PL007.6.e 版本 V0.1.1.0 定版 —— 做法：config/version.json 单点改 V0.1.1.0，README 徽章/x.progress 版本行/z.plan PL007 状态行四处同步；验证：四处动态读取一致 + 四段式正则 V\d+\.\d+\.\d+\.\d+
- [x] PL007.6.f commit 草稿 —— 做法：按 V2 规范草拟（git add 清单 + message `feat: V0.1.1.0，界面信息层补全与视觉收敛（标题行/比分进度/币面文字化/色收敛）`），AI 不执行 git 写操作；验证：用户审阅后自行执行

---

## PL008. 单次投掷模式与持久化战绩任务清单（依据 z.plan.md PL008，2026-11-10）

> 状态：✅ 已实施（V0.1.2.0，2026-11-10：verify_history 新增 + verify_game/rules/ui 重写调整，run_all 5/5 全绿；浏览器冒烟待用户确认）
> 方案：z.plan.md PL008（删除多局模式、成绩改战绩、每次投掷记录日期时间+yes/no、localStorage 持久化、手动清零）
> 拍板（2026-11-10）：按钮样式替换暂缓（后续整体 UI）；本 patch 只做删除/改名/战绩表
> 硬限制：沿用 PL001——禁 WebGL/WASM/Workers/eval/外链 JS；依赖全内嵌；动效只动 transform/opacity；触区 ≥44px
> 版本归属：V0.1.2.0（PL008.5 定版同步）

#### PL008.1 删除多局玩法与模式 UI

- [x] PL008.1.a index.html 删除模式区 —— 做法：移除 #mode-area 整块（三按钮 + #custom-picker/#slot-x/#slot-y）与 #score-progress 容器；验证：grep 断言 mode-area/custom-picker/score-progress 零残留 + collectRefs 骨架断言通过
- [x] PL008.1.b game.js 简化单次投掷 —— 做法：删 resolveXY/checkFinished/needOvertime 与 toss 的局次派生；createGame 收敛为单次会话快照，toss 一次出 face（随机源仍走 random.js deriveSeed，seed 记录保留）；验证：verify_game 调整后断言单次投掷/同 seed 同结果
- [x] PL008.1.c rules.js 删模式契约 —— 做法：删 MODES/DEFAULT_MODE/GAME_MIN_ROUNDS/GAME_MAX_ROUNDS/validateGameConfig；REQUIRED_KEYS 增 historyLimit/clearConfirmMs、删 defaultMode；THEMES 不动；验证：verify_rules 契约同步断言
- [x] PL008.1.d ui.js 删模式渲染 —— 做法：删 nextModeState/yRangeFor/buildSlot/PICKER_MIN/MAX/cnDigit/renderScoreProgress/idleHintFor 多模式分支；collectRefs 移除 mode/slot/scoreProgress；验证：grep 零残留 + verify_pl007_ui 调整
- [x] PL008.1.e main.js 删模式编排 —— 做法：删 applyModeUI/onModeChange/bindModeButtons/bindSlotDrag/offsetOf/custom 状态/比分接线；resetGame 收编为「重置硬币与结果区」（不再清战绩）；验证：冒烟 + grep 零残留
- [x] PL008.1.f config/rules.json 与 css 清理 —— 做法：config 删 defaultMode、增 historyLimit(1000)/clearConfirmMs(3000)；css 删模式按钮/选择器/比分条规则；验证：verify_rules 加载真实 config + css 类名 grep 零残留

#### PL008.2 战绩持久化内核（js/history.js 新增）

- [x] PL008.2.a 纯函数内核 —— 做法：appendHistory(records, record, limit)（超限丢最旧）/parseHistory(json)（坏 JSON 返回空数组不崩溃）/serializeHistory(records)；验证：verify_history 追加/上限/坏 JSON/序列化往返断言
- [x] PL008.2.b 存储包装 —— 做法：loadHistory(storage)/saveHistory(storage, records)/clearHistory(storage)，storage 注入便于 stub；键名 `fortune-choice.history.v1`；try/catch 宽容降级（localStorage 不可用时空数组不崩）；验证：verify_history stub storage 断言读写与降级
- [x] PL008.2.c 接线 —— 做法：main.js settle 落定后 appendHistory({at: Date.now(), face}) + saveHistory；初始化 loadHistory 供战绩浮窗读取；验证：冒烟投掷后刷新记录仍在

#### PL008.3 战绩浮窗 UI

- [x] PL008.3.a 改名与列表渲染 —— 做法：底部按钮「成绩」→「战绩」、浮窗标题「本轮成绩」→「战绩」；ui.js renderHistoryList(el, records) 倒序渲染（同日 `11-10 13:00`，跨年 `2025-12-31 23:59`）+ 复用 .score-dot 金/银圆点 + YES/NO；空态「暂无战绩」；验证：verify_pl007_ui 战绩渲染断言（格式/倒序/空态）
- [x] PL008.3.b 清零入口与二次确认 —— 做法：战绩浮窗内「清除全部战绩」按钮，首按变「再按一次确认」，clearConfirmMs 内未再按恢复；执行后 clearHistory + 列表空态；不用原生 confirm；验证：冒烟二次确认流程 + verify_history 清零断言

#### PL008.4 文案与文档同步

- [x] PL008.4.a 待机文案简化 —— 做法：结果区待机改「左右滑动 · 抛硬币」；验证：verify_pl007_ui 文案断言更新
- [x] PL008.4.b README/AGENTS 同步 —— 做法：删除多局玩法描述（三局两定/五局三定/自定义/加赛），战绩持久化与手动清零说明入特性与使用说明；验证：文档与实况比对
- [x] PL008.4.c z.plan 状态 —— 做法：PL008 状态行改已实施并注明版本；验证：与提交范围一致

#### PL008.5 验证收尾与版本定版

- [x] PL008.5.a verify_history.js 新增 —— 做法：.temp/ 纯函数 + stub storage 断言组；验证：node 直跑 0 失败并纳入 run_all
- [x] PL008.5.b 既有 verify 调整 —— 做法：verify_rules（删模式断言/新增配置键）/verify_game（单次投掷）/verify_pl007_ui（删比分/模式断言、增战绩断言）同步；验证：run_all 全量 0 失败
- [x] PL008.5.c 冒烟与目检 —— 做法：浏览器全链路（投掷→战绩记录→刷新仍在→清零二次确认→再投掷继续记录）；验证：用户目检确认
- [x] PL008.5.d 版本 V0.1.2.0 定版 —— 做法：config/version.json 单点改 V0.1.2.0（第三位推进 1），README 徽章/x.progress 版本行/z.plan PL008 状态行四处同步；验证：四处动态读取一致 + 四段式正则
- [x] PL008.5.e commit 草稿 —— 做法：按 V2 规范在对话中给出（git add 清单 + message），不写入本文档；验证：用户审阅后自行执行

---

## PL009. 四季主题框架与界面重构任务清单（依据 z.plan.md PL009，2026-11-10）

> 状态：✅ 已实施（V0.1.3.0，2026-11-10：四季主题/背景 4 张/猫咪 SVG 占位/丝带与浮窗落地；verify_theme + verify_pl009_ui 新增，run_all 6/6 全绿；浏览器目检待用户确认）
> 方案：z.plan.md PL009（按 design/prototype.html v2 搭框架；4 张背景图；猫咪 SVG 占位；主题自动/手动）
> 硬限制：沿用 PL001——禁 WebGL/WASM/Workers/eval/外链 JS；依赖全内嵌；动效只动 transform/opacity；触区 ≥44px
> 版本归属：V0.1.3.0（PL009.6 定版同步）

#### PL009.1 主题内核（js/rules.js + js/theme.js + config/rules.json）

- [x] PL009.1.a 四季常量与判断 —— 做法：rules.js 新增 `SEASONS`（spring/summer/autumn/winter）、`SEASON_THEMES`（每季配色/装饰/背景文件）、`seasonOf(date)` 纯函数（3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬）；验证：verify_theme 断言四季月份边界与配色键齐全
- [x] PL009.1.b 主题持久化内核 —— 做法：新增 js/theme.js：`loadThemeMode(storage)`/`saveThemeMode(storage, state)`（键 `fortune-choice.theme.v1`，storage 注入、坏 JSON/异常宽容降级）；验证：verify_theme stub storage 断言读写/坏数据/异常降级
- [x] PL009.1.c 配置契约同步 —— 做法：config/rules.json 增 `themeAutoDefault`（默认 true）；REQUIRED_KEYS 与 validateRules 同步；验证：verify_rules 断言

#### PL009.2 结构重构（index.html）

- [x] PL009.2.a 骨架重排 —— 做法：背景层 / 标题胶囊（含季节装饰 SVG）/ 硬币舞台 / 猫咪占位容器 / 提示胶囊 / 结果丝带 / 底部按钮（战绩粉·换主题绿）/ 两个浮窗；验证：collectRefs 骨架断言 + grep 结构
- [x] PL009.2.b 猫咪 SVG 占位 —— 做法：小黑（德文奶牛母猫）/小白（德文纯白公猫）内联 SVG 待机姿态 + 名字标签（小黑 ♀ / 小白 ♂）；欢呼/探头结构预留；验证：DOM 断言 + 目检
- [x] PL009.2.c 浮窗结构 —— 做法：战绩（粉色标题胶囊/列表/清除/关闭）+ 换主题（2×2 场景占位卡/勾选/自动开关/当前季节/关闭）；验证：DOM stub 断言

#### PL009.3 四季样式（css/coin.css）

- [x] PL009.3.a 主题变量与贴纸组件 —— 做法：四季配色变量（`--bg/--card/--accent/--btn-theme/--deco-*`）、描边/圆角/硬阴影统一、按钮粉/绿；验证：cssBlock 断言 + 目检
- [x] PL009.3.b 布局尺寸 —— 做法：标题 334×108 / 硬币 240 / 猫咪 140 / 提示 350×48 / 按钮 163×76；clamp + 变量适配 375–440；验证：inspect 测量 + 375/390/440 目检
- [x] PL009.3.c 结果态样式 —— 做法：丝带（主体 + 燕尾 clip-path）、彩纸屑（5 片 CSS 动画）、猫咪欢呼类；验证：目检 + class 断言
- [x] PL009.3.d 浮窗与列表样式 —— 做法：浮窗滑入 200ms、战绩列表（时间 + 硬币头像 + YES/NO）、主题卡 + 勾选 + 开关；验证：目检

#### PL009.4 背景图生成与接入

- [x] PL009.4.a 生成 4 张背景 —— 做法：生图 9:21（1K）→ 中心裁 9:19.5 → 880×1912 @2x WebP；背景无猫咪/无文字、中央留净；验证：尺寸/格式/体积 ≤120KB/张
- [x] PL009.4.b 背景接入 —— 做法：assets/ui/bg-<season>@2x.webp + CSS background-image/cover；验证：四季切换背景变化目检

#### PL009.5 交互与状态（js/main.js + js/ui.js）

- [x] PL009.5.a 主题初始化与自动切换 —— 做法：启动读持久化（auto/manual）；auto 按月份取季节；手动选择→manual 并保存；浮窗开关→auto 并保存；storage 异常降级；验证：verify_theme + 目检
- [x] PL009.5.b 结果态切换 —— 做法：落定→丝带/彩纸屑/猫咪欢呼（class 移除→reflow→添加保证可重复）；待机复位；验证：目检 + class 断言
- [x] PL009.5.c 战绩浮窗接线 —— 做法：列表渲染（时间/硬币头像/YES/NO）、清零二次确认、关闭；验证：DOM stub + 目检
- [x] PL009.5.d 换主题浮窗接线 —— 做法：四卡选择、自动开关、当前季节文案、关闭；验证：目检

#### PL009.6 验证收尾与版本定版

- [x] PL009.6.a verify_theme.js 新增 —— 做法：季节判断/主题模式/持久化宽容降级断言组；验证：node 直跑 0 失败并纳入 run_all
- [x] PL009.6.b verify_pl008_ui 调整 —— 做法：新结构/丝带/猫咪占位/浮窗/主题变量断言同步；验证：run_all 全量 0 失败
- [x] PL009.6.c 目检与 taste-skill 复测 —— 做法：浏览器四季/投掷/战绩/浮窗/动效；lint + inspect 复测（贴纸风豁免记录）；验证：用户目检确认
- [x] PL009.6.d 文档同步与版本定版 —— 做法：README/AGENTS 主题说明同步；config/version.json 单点改 V0.1.3.0（第三位推进 1），四处同步；验证：四处动态读取一致 + 四段式正则
- [x] PL009.6.e commit 草稿 —— 做法：按 V2 规范在对话中给出（git add 清单 + message），不写入本文档；验证：用户审阅后自行执行

---

## Patch001. 主题卡视觉与交互修正任务清单（2026-11-10）

> 状态：✅ 已实施（V0.1.3.1，run_all 6/6）
> 来源：用户反馈（缩略图季节化 / 季节图标缺失 / 切主题整窗重播 / 浮窗透明）

- [x] Patch001.1 浮窗透明修复 —— 做法：四季 CSS 变量作用域 `#app[data-season]` → `body[data-season]`，`renderSeason` 同步 `body.dataset.season`；验证：截图浮窗实底、无透明
- [x] Patch001.2 主题卡样式对齐设计稿 —— 做法：卡片实底/白+棕双层描边/标签条不透明/勾选白勾/遮罩减淡/关闭按钮粉色；验证：截图对照 `design/overlay-theme.png`
- [x] Patch001.3 四季缩略图统一 4:3 —— 做法：统一 320×240（夏为生图 4:3，春/秋/冬按背景原图重裁）；验证：四张尺寸一致、卡片显示正常
- [x] Patch001.4 季节象征透明图标 —— 做法：生图透明背景 4 张 256×256 PNG（樱花/向日葵/枫叶/雪花）；验证：四角 alpha=0、体积约 302KB
- [x] Patch001.5 主题卡中央图标叠加 —— 做法：`emblem` 绝对定位场景区中心、卡宽 45%；验证：截图四卡图标显示正常
- [x] Patch001.6 切主题不重建浮窗 —— 做法：新增 `updateThemeSelection` 仅更新选中态/当前季节，去除 `openTheme` 整窗重建；验证：截图点冬卡后浮窗保持、背景变冬
- [x] Patch001.7 原图存档 —— 做法：背景原图与图标原图存 `design/backgrounds/`；验证：文件在位
- [x] Patch001.8 规范与版本 —— 做法：AGENTS.md 补 Patch 命名规范；版本 V0.1.3.1 四处同步；验证：四处动态读取一致 + 四段式正则
