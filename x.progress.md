# 开发进度追踪（x.progress.md）

> 依据：`z.plan.md`（幸运硬币选择方案报告，PL001）
> 当前版本：V0.1.0.2（单一来源：`config/version.json`；AGENTS.md「版本号唯一来源」约定）
> 记录格式：状态 [⏳ 待开发, ✅ 已完成] / 优先级 [高, 中, 低]
> 执行原则：每阶段完成后运行验证命令确认无回归，再进入下一阶段
> 错误策略：不崩溃、不阻塞、有提示、能自愈——统一中文错误类型 / fail-fast 与明确回落并用 / 宽容解析（详见 AGENTS.md 错误策略主线）

---

## 阶段验证命令速查（AGENTS.md 运行与验证）

```shell
# 无头回归总入口（PL001：4 个 verify_* 全量）
python3 .temp/run_all.py                 # 全量回归（随机/规则/对局/硬币）
node .temp/verify_random.js       # PL001.1 随机源：同/异 seed / 分布 / 派生
node .temp/verify_rules.js        # PL001.2 规则契约：模式枚举 / Y≤X 约束 / 滑动参数 / 主题
node .temp/verify_game.js         # PL001.3 对局状态机：X局Y定 / 加赛 / 一局定输赢 / 终局
node .temp/verify_coin.js         # PL001.4 硬币动画（纯计算 + DOM stub）：终面角 / 减速参数
node .temp/probe_pl001_ui.js      # PL001.6 UI 层（DOM stub）：模式区/数字选择器/硬币/结果区/浮窗
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

- [x] PL001.7.a run_all.py：枚举执行全部 verify_*（node 子进程）统一出口计数汇总，任一失败非零退出——做法：参考参考项目 run_all.py 写法；验证：注入临时失败脚本断言非零退出
- [x] PL001.7.b 全量回归 = 全部 verify_* 0 失败；校验**不变量**为主，禁止写死易变值（A018 验证纪律：版本/日期/路径/计数不写死，用正则/动态读取）——验证：run_all.py 0 失败（4 脚本全绿）

#### PL001.8 文档同步与版本定版

- [x] PL001.8.a AGENTS.md 玩法描述更新：单局 yes/no → 多局模式（三局两定/五局三定/自定义 X局Y定/一局定输赢 + 加赛）——做法：AGENTS.md 开头描述段落与相关约定同步；验证：文档与定稿玩法比对
- [x] PL001.8.b README 更新：简介 / 特性 / 使用说明 / 项目结构树 / 徽章与玩法描述同步——做法：README 全面更新；验证：文档与代码实况比对
- [x] PL001.8.c 版本 V0.1.0.0 四处同步：version.json / README 徽章 / x.progress 版本行 / z.plan 状态行——做法：单点改 version.json，其余同步；验证：四处动态读取比对一致 + 四段式正则 `V\d+\.\d+\.\d+\.\d+`
- [x] PL001.8.d 离线包完整性核查：index.html + css/ + js/ + config/ 全内嵌、零外部 CDN 外链、零禁用 API（WebGL/Workers/eval/new Function/document.write/内联事件 grep 清零）——验证：grep 反向断言
- [x] PL001.8.e commit 草稿按 V2 规范给出（git add 清单 + message，形如 `feat: V0.1.0.0，丢硬币多局玩法与 3D 硬币交互...`），AI 不执行 git 写操作——验证：草稿经用户审阅后由用户执行

### commit 草稿（V2 规范，2026-08-27 PL001）

- [x] PL001 系列完成后草拟（2026-08-27 完成）：
  - 标题：`feat: V0.1.0.0，幸运硬币选择丢硬币多局玩法与 3D 硬币交互`
  - 正文：`- 模式互斥单选（三局两定/五局三定/自定义/一局定输赢），自定义数字滑动选择器 Y≤X 联动` / `- X局Y定收敛与加赛一局定生死` / `- 硬币三面 2 套主题，CSS3 3D 旋转，滑动加速超时自动落定` / `- 成绩与设置浮窗，终局重置`
  - git add 清单（用户审阅后自行执行）：index.html package.json css/coin.css js/ config/ .temp/（verify__.js probe__.js run_all.py assert_lite.mjs）AGENTS.md README.md z.plan.md x.progress.md .gitignore .opencode/skills/
  - 验证：用户审阅后自行 git add/commit/push（AI 不执行 git 写操作）

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
- [x] A3.10 settle 400ms 简化 —— main.js settle 删 Math.max(400,diff*3) 过渡与 400ms 外层延迟（引导已精确落定）；验证：verify_a_fixes + verify_a_accept 收敛无回归（2026-08-28）
- [x] A3.11 score.push 冗余三元 —— main.js 终局分支简化为 ctx.game.decision；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.12 init 错误条防注入 —— main.js catch 改 createElement+textContent；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.13 slot-y aria 补齐 —— index.html #slot-y 加 aria-valuemin="2" aria-valuemax="9"；验证：verify_a_fixes 断言（2026-08-28）
- [x] A3.14 历史三面快照加注 —— z.plan.md 5 处 + x.progress.md:34 补"（注：现实现已改双面）"；验证：verify_a_fixes 断言（2026-08-28）

#### A4 验证与收尾

- [x] A4.1 全量回归 —— run_all 6/6（含 verify_a_fixes）+ probe 2 个 + verify_a_accept 5/5 + 冒烟 import 全模块 OK；验证：0 失败（2026-08-28）
- [x] A4.2 commit 草稿 —— git add 清单 + message（feat: V0.1.0.1 含审计修复），见下方；验证：用户审阅

### commit 草稿（V2 规范，2026-08-28 A 系列，版本 V0.1.0.2）

- 标题：`fix: V0.1.0.2，首轮代码审计修复（定时器竞态/配置清理/交互优化/文档同步）`
- 正文：
  - `- 修复对局竞态：落定/停留/翻转定时器由重置统一清理，切换模式不再污染新局成绩与硬币状态`
  - `- 移除 turns/flipMs 无效配置，清理无用 import 与样式变量，落定流程去掉多余过渡`
  - `- 终局展示本局 seed，同一 seed 可复现整局结果（可解释可复现）`
  - `- 自定义数字选择器吸附按实际宽度校准（窄屏不错位），拖动跟手不滞后`
  - `- 启动失败错误条改为纯文本防注入；定数选择器补齐无障碍属性`
  - `- 文档同步：README 与模块说明三面改双面，进度清单勾选修正，历史条目加注（审计报告见 z.plan 附录）`
  - `- 版本推进 V0.1.0.2`
- git add 清单（用户审阅后自行执行）：config/rules.json config/version.json css/coin.css index.html js/coin.js js/main.js js/rules.js js/ui.js README.md x.progress.md z.plan.md
