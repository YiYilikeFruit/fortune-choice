// ============================================================
// 幸运硬币选择 - 启动装配与对局编排
// 设计要点：装配层是唯一业务容器——加载配置 → 创建对局 →
// 驱动 game（toss/setStatus）与 coin（tick/finalFace）配合动画表现；
// 结果先由 toss 计算，动画只是落点表现不弄虚作假；
// 错误入口统一提示不崩溃（降级不中断，错误策略主线）。
// 关联配置：config/rules.json、config/version.json。
// ============================================================

import { validateRules, MODES, THEMES, DEFAULT_THEME } from "./rules.js";
import { createGame, toss, setStatus, STATUS } from "./game.js";
import { tick, guidedStep } from "./coin.js";
import * as ui from "./ui.js";

// 解析配置 JSON 文本（装配层唯一解析入口）
// 输入：text JSON 字符串、label 配置名（用于错误定位）；输出：解析对象
// 异常：坏 JSON → 中文 fail-fast，消息含配置名定位，不静默回落
export function parseConfig(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`配置文件「${label}」解析失败：${e.message}`);
  }
}

// 加载配置：fetch + parseConfig（网络/HTTP/解析三层错误分别中文提示）
// 输入：url 配置路径、label 配置名；输出：解析对象
// 异常：网络错误 / 非 2xx / 坏 JSON → 中文 fail-fast（错误策略主线）
export async function loadJson(url, label) {
  let resp;
  try {
    resp = await fetch(url);
  } catch (e) {
    throw new Error(`配置文件「${label}」加载失败（网络错误）：${e.message}`);
  }
  if (!resp.ok) {
    throw new Error(`配置文件「${label}」加载失败：HTTP ${resp.status}`);
  }
  const text = await resp.text();
  return parseConfig(text, label);
}

// 启动装配：加载 rules 与 version，规范化规则对象
// 输入：无（从固定相对路径读取）；输出：{ rules, version }
// 异常：任一配置加载/契约失败 → 中文 fail-fast（装配期一次完成）
export async function bootstrap() {
  const rulesRaw = await loadJson("config/rules.json", "rules.json");
  const version = await loadJson("config/version.json", "version.json");
  const rules = validateRules(rulesRaw);
  return { rules, version };
}

// 生成对局 seed（MVP：随机生成，可复现性由结果快照记录）
function makeSeed() {
  return `coin-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// 对局编排上下文（单例，由 init 创建）
function createCtx(rules, version) {
  return {
    rules,
    version,
    game: null,
    theme: DEFAULT_THEME,
    mode: rules.defaultMode,
    custom: { x: 3, y: 2 },
    slotX: null,
    slotY: null,
    score: [],
    velocity: 0,
    angle: 0,
    pending: null,
    settling: false,
    guiding: false,
    idleTimer: null,
    settleId: null,
    holdId: null,
    flipId: null,
    rafId: null,
    lastT: 0,
  };
}

// 重置整轮对局（终局后/换模式时调用）
// 输入：ctx 编排上下文；输出：无
function resetGame(ctx, refs) {
  // 清理残留定时器：防旧局落定/停留/翻转回调污染新局（切换模式/重置时触发）
  clearTimeout(ctx.idleTimer);
  clearTimeout(ctx.settleId);
  clearTimeout(ctx.holdId);
  clearTimeout(ctx.flipId);
  ctx.idleTimer = null;
  ctx.settleId = null;
  ctx.holdId = null;
  ctx.flipId = null;
  ctx.game = createGame(
    { mode: ctx.mode, x: ctx.custom.x, y: ctx.custom.y },
    makeSeed(),
  );
  ctx.pending = null;
  ctx.settling = false;
  ctx.guiding = false;
  ctx.velocity = 0;
  ctx.angle = 0;
  ctx.score = [];
  ui.setCoinAngle(refs.coin, 0);
  // 壁色/齿环色随主题（PL002）：renderCoinTheme 设面与壁色，随后覆盖两面为展示面
  ui.renderCoinTheme(refs, THEMES[ctx.theme]);
  // 初始/重置无结果，双面均为展示面
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "yes");
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "no");
  ui.renderRoundResult(refs.roundResult, "");
  ui.renderProgress(refs.progress, "");
  ui.showReset(refs.resetBtn, false);
}

// 动画主循环：自由衰减推进旋转，减速后期切换到落点引导（速度与剩余角成正比，
// 速度归 0 恰停结果面，无 finalFace 校正动画）
// 输入：ctx、refs、now 时间戳；输出：无（持续 rAF 直至落定）
function frame(ctx, refs, now) {
  const dt = Math.min(50, now - ctx.lastT);
  ctx.lastT = now;

  // 落点引导：真实纯函数 guidedStep 驱动，前段自由衰减自然旋转，减速后期引导精确落定
  if (ctx.pending) {
    const step = guidedStep(
      ctx.angle,
      ctx.velocity,
      ctx.pending.face,
      ctx.guiding,
      {
        speedThreshold: ctx.rules.guideSpeedThreshold,
        minRemainingDeg: ctx.rules.guideMinRemainingDeg,
        speedFactor: ctx.rules.guideSpeedFactor,
      },
      dt,
    );
    if (step.landed) {
      ctx.angle = step.angle;
      ctx.velocity = 0;
      ctx.guiding = true;
      ui.setCoinAngle(refs.coin, ctx.angle);
      ctx.rafId = null;
      settle(ctx, refs);
      bounce(refs);
      return;
    }
    if (step.guiding) {
      ctx.guiding = true;
      ctx.velocity = step.velocity;
      ctx.angle = step.angle;
      ui.setCoinAngle(refs.coin, ctx.angle);
      ctx.rafId = requestAnimationFrame((t) => frame(ctx, refs, t));
      return;
    }
  }

  // 自由衰减阶段：物理指数衰减（自然转数由初速度决定）
  ctx.velocity = tick(dt, ctx.velocity, ctx.rules.decelDurationMs);
  ctx.angle += ((ctx.velocity * dt) / 1000) * 360;
  ui.setCoinAngle(refs.coin, ctx.angle);

  if (ctx.velocity === 0) {
    ctx.rafId = null;
    settle(ctx, refs);
    return;
  }
  ctx.rafId = requestAnimationFrame((t) => frame(ctx, refs, t));
}

// prefers-reduced-motion 探测（PL003）：系统偏好减少动效时快进落定
// 输入：无；输出：布尔（true = 需减少动效）
function prefersReducedMotion() {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// 落定冲击 bounce（PL003）：coin 外层短暂 scale(0.97→1) 弹回，纯表现层不动 rotateY
// 输入：refs（含 coinScene）；输出：无（150ms 动画结束自动复位，下次触发需重启动画）
function bounce(refs) {
  refs.coinScene.classList.remove("coin-landed");
  void refs.coinScene.offsetWidth; // 强制 reflow 重启动画
  refs.coinScene.classList.add("coin-landed");
}

// 滑动触发：叠加旋转速度、重置超时计时；首次滑动先 toss 定本局结果
// 输入：ctx、refs、deltaX 本次滑动位移；输出：无
function onSwipe(ctx, refs, deltaX) {
  // 落定展示期间忽略滑动，避免打断落定动画/重复记分
  if (ctx.settling) return;
  // 仅当没有进行中的本局且已终局才拦截（终局后禁止再抛新局）
  if (!ctx.pending && ctx.game.finished) return;
  // 横向位移不足（含纯垂直滑动）不视为抛硬币手势，避免误触出结果
  if (Math.abs(deltaX) < ctx.rules.swipeThreshold) return;
  if (!ctx.pending) {
    const g = toss(ctx.game);
    ctx.game = g;
    ctx.pending = {
      face: g.results[g.results.length - 1],
      finished: g.finished,
      decision: g.decision,
    };
    ctx.game = setStatus(ctx.game, STATUS.ROTATING);
    // 硬币双面换成 yes/no，进入抛硬币
    ui.renderCoinTheme(refs, THEMES[ctx.theme]);
    // 减少动效（PL003）：系统偏好 reduce 时跳过旋转动画，直接落定到结果面
    if (prefersReducedMotion()) {
      ctx.angle = ctx.pending.face === "yes" ? 0 : 180;
      ctx.velocity = 0;
      ctx.rafId = null;
      settle(ctx, refs);
      return;
    }
  }
  const swipePower = Math.abs(deltaX) / 16;
  ctx.velocity = Math.min(
    30,
    ctx.velocity + swipePower * ctx.rules.accelFactor,
  );
  ctx.game = setStatus(ctx.game, STATUS.ROTATING);

  if (!ctx.rafId) {
    ctx.lastT = performance.now();
    ctx.rafId = requestAnimationFrame((t) => frame(ctx, refs, t));
  }
  clearTimeout(ctx.idleTimer);
  ctx.idleTimer = setTimeout(() => {
    ui.showToast(refs.toast, "是决定的时候了");
  }, ctx.rules.idleTimeoutMs);
}

// 落定：展示结果，终局出重置按钮并暴露 seed（可复现）；非终局停留结果面后翻转回展示面。
// 引导已使 angle 精确等于目标结果面（无角度差），此处不再做对齐过渡。
// 定时器句柄存 ctx（holdId/flipId），由 resetGame 统一清理防竞态污染新局。
// 输入：ctx、refs；输出：无
function settle(ctx, refs) {
  if (!ctx.pending) return;
  ctx.settling = true;
  const resultFace = ctx.pending.face;
  const finished = ctx.pending.finished;
  const faceText = resultFace === "yes" ? "YES" : "NO";
  const round = ctx.game.currentRound;
  ctx.pending = null;

  if (finished) {
    ctx.settling = false;
    ctx.score.push({ round, face: ctx.game.decision });
    ui.renderRoundResult(
      refs.roundResult,
      `最终答案：${ctx.game.decision.toUpperCase()}！`,
      true,
    );
    // 暴露本局 seed：同一 seed 可复现整局结果
    ui.renderProgress(refs.progress, `seed: ${ctx.game.seed}`);
    ui.showReset(refs.resetBtn, true);
    return;
  }

  ctx.score.push({
    round,
    face: ctx.game.results[ctx.game.results.length - 1],
  });
  ui.renderRoundResult(refs.roundResult, `第${round}局：${faceText}`);
  // 结果面停留 resultHoldMs，让用户看清本局结果，再慢速转回展示面
  ctx.holdId = setTimeout(() => {
    // 只把背面（翻转后将朝前的那面）换成展示面：当前朝前的结果面保持结果，
    // 翻转过程 = 结果面翻走、展示面翻来，翻转结束硬币本体即展示面
    const which = resultFace === "yes" ? "no" : "yes";
    ui.setCoinShowFace(refs, THEMES[ctx.theme], which);
    // 统一再转半圈（180°）：无论落在 yes(0°) 还是 no(180°)，
    // 转回都有可见旋转动画（直接归 0 在 yes 面时无视觉变化会跳变）
    ctx.angle += 180;
    // 翻转曲线（PL003）：ease-in-out + 轻微 overshoot（0.34,1.4,0.4,1），
    // 180° 翻转带一点惯性回弹，去"被推走"的直线感
    refs.coin.style.transition = `transform ${ctx.rules.resetFlipMs}ms cubic-bezier(0.34, 1.4, 0.4, 1)`;
    ui.setCoinAngle(refs.coin, ctx.angle);
    ctx.flipId = setTimeout(() => {
      refs.coin.style.transition = "none";
      ctx.settling = false;
    }, ctx.rules.resetFlipMs + 60);
  }, ctx.rules.resultHoldMs);
}

// 更新模式按钮与自定义选择器显隐（互斥状态机）
// 输入：ctx、refs；输出：无
function applyModeUI(ctx, refs) {
  for (const btn of refs.modeButtons.querySelectorAll(".mode-btn")) {
    btn.classList.toggle("active", btn.dataset.mode === ctx.mode);
  }
  const isCustom = ctx.mode === MODES.CUSTOM;
  refs.picker.classList.toggle("hidden", !isCustom);
}

// 切换对局模式：互斥 + 取消，无按钮 = 一局定输赢
// 输入：ctx、refs、target 模式；输出：无
function onModeChange(ctx, refs, target) {
  ctx.mode = ui.nextModeState(ctx.mode, target);
  applyModeUI(ctx, refs);
  resetGame(ctx, refs);
}

// 模式按钮绑定（事件委托）
// 输入：ctx、refs；输出：无
function bindModeButtons(ctx, refs) {
  refs.modeButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (btn) onModeChange(ctx, refs, btn.dataset.mode);
  });
}

// 自定义选择器拖动：上下两槽共用拖动逻辑，吸附后回调联动
// 输入：ctx、refs、slotEl、handle、onChange；输出：无
function bindSlotDrag(ctx, refs, slotEl, handle, onChange) {
  let dragging = false;
  let startX = 0;
  let baseOffset = 0;
  const offset = () => {
    const m = handle.track.style.transform.match(/translateX\((-?[\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  };
  slotEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    startX = e.clientX;
    baseOffset = offset();
    slotEl.setPointerCapture(e.pointerId);
  });
  slotEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    handle.setOffset(baseOffset + (e.clientX - startX));
  });
  const up = () => {
    if (!dragging) return;
    dragging = false;
    const idx = handle.snapFromOffset(offset());
    handle.setIndex(idx);
    onChange(handle.getValue());
  };
  slotEl.addEventListener("pointerup", up);
  slotEl.addEventListener("pointercancel", up);
}

// 绑定所有 UI 交互
// 输入：ctx、refs；输出：无
function bindUI(ctx, refs) {
  bindModeButtons(ctx, refs);

  ctx.slotX = ui.buildSlot(refs.slotX);
  ctx.slotY = ui.buildSlot(refs.slotY);
  ctx.slotX.setIndex(ctx.custom.x - ui.PICKER_MIN);
  ctx.slotY.setIndex(ctx.custom.y - ui.PICKER_MIN);
  bindSlotDrag(ctx, refs, refs.slotX, ctx.slotX, (x) => {
    ctx.custom.x = x;
    const { lo, hi } = ui.yRangeFor(x);
    const disabled = new Set();
    for (let v = ui.PICKER_MIN; v <= ui.PICKER_MAX; v++) {
      if (v < lo || v > hi) disabled.add(v - ui.PICKER_MIN);
    }
    ctx.slotY.setIndex(ctx.slotY.snapFromOffset(offsetOf(ctx.slotY)), disabled);
    if (ctx.custom.y > x) ctx.custom.y = x;
    if (ctx.mode === MODES.CUSTOM) resetGame(ctx, refs);
  });
  bindSlotDrag(ctx, refs, refs.slotY, ctx.slotY, (y) => {
    ctx.custom.y = y;
    if (ctx.mode === MODES.CUSTOM) resetGame(ctx, refs);
  });

  // 硬币滑动：pointer 事件，位移换算旋转速度
  let swiping = false;
  let swipeX = 0;
  refs.coinStage.addEventListener("pointerdown", (e) => {
    swiping = true;
    swipeX = e.clientX;
    refs.coinStage.setPointerCapture(e.pointerId);
  });
  refs.coinStage.addEventListener("pointermove", (e) => {
    if (!swiping) return;
    onSwipe(ctx, refs, e.clientX - swipeX);
    swipeX = e.clientX;
  });
  refs.coinStage.addEventListener("pointerup", () => {
    swiping = false;
  });
  refs.coinStage.addEventListener("pointercancel", () => {
    swiping = false;
  });

  refs.scoreBtn.addEventListener("click", () => {
    if (!refs.overlay.hidden) {
      ui.hideOverlay(refs.overlay);
      return;
    }
    const content = ui.buildScoreContent(ctx.score);
    ui.showOverlayCard(refs.overlay, "本轮成绩", content);
  });
  refs.settingsBtn.addEventListener("click", () => {
    if (!refs.overlay.hidden) {
      ui.hideOverlay(refs.overlay);
      return;
    }
    const content = ui.buildSettingsContent(ctx.theme, (name) => {
      ctx.theme = name;
      // 切主题统一渲染 yes/no 双面（所有主题同一逻辑）
      ui.renderCoinTheme(refs, THEMES[name]);
      const box = content.querySelector(".theme-options");
      for (const btn of box.querySelectorAll(".theme-option")) {
        btn.classList.toggle("active", btn.dataset.theme === name);
      }
    });
    ui.showOverlayCard(refs.overlay, "更换硬币", content);
  });
  refs.resetBtn.addEventListener("click", () => {
    resetGame(ctx, refs);
  });
}

// 选择器轨道当前位移（辅助联动）
function offsetOf(handle) {
  const m = handle.track.style.transform.match(/translateX\((-?[\d.]+)px\)/);
  return m ? parseFloat(m[1]) : 0;
}

// 启动入口：加载配置 → 装配 UI → 创建对局
// 输入：无；输出：Promise
// 异常：配置/骨架任一失败 → 页面提示区展示中文错误，不崩溃
export async function init() {
  let ctx;
  try {
    const { rules, version } = await bootstrap();
    const refs = ui.collectRefs();
    ctx = createCtx(rules, version);
    ctx.refs = refs;
    applyModeUI(ctx, refs);
    resetGame(ctx, refs);
    // 硬币立体化（PL002）：读 :root 变量构建圆柱侧面壁（分段数/厚度/半径）
    const cs = getComputedStyle(document.documentElement);
    const segN = parseInt(cs.getPropertyValue("--coin-seg")) || 24;
    // 半径取实际渲染尺寸（--coin-size 为 min(58vw,240px) 表达式，parseFloat 会失败，
    // 且随断点变化；offsetWidth 为真实值，保证圆环与两面同尺寸对齐）
    const coinSize = refs.coin.offsetWidth || 240;
    const thick = parseFloat(cs.getPropertyValue("--coin-thick")) || 10;
    ui.buildCoinEdge(refs.coin, segN, coinSize / 2, thick);
    bindUI(ctx, refs);
  } catch (e) {
    // 错误条用 textContent 赋值，避免配置内容含 HTML 标签时注入
    const bar = document.createElement("div");
    bar.textContent = String(e.message);
    bar.style.cssText =
      "position:fixed;inset:auto 0 0 0;padding:14px;background:#ef476f;color:#fff;z-index:99";
    document.body.appendChild(bar);
  }
  return ctx;
}

// 浏览器环境启动装配（node 无头 import 时不启动，避免 fetch/DOM 依赖）
// 输入：无；输出：无（启动后由 DOM 事件驱动对局）
if (typeof window !== "undefined" && typeof document !== "undefined") {
  init();
}

// ===== js/main.js 模块说明 =====
// 函数清单与逻辑：
// - parseConfig/loadJson/bootstrap：配置加载契约（装配层唯一 IO 入口）
// - makeSeed()：生成对局 seed（随机，结果快照记录）
// - createCtx(rules, version)：对局编排上下文（单例容器，含定时器句柄）
// - resetGame(ctx, refs)：整轮重置（清理定时器防竞态、归零对局/硬币状态）
// - frame(ctx, refs, now)：动画主循环——自由衰减 + 落点引导 guidedStep 精确落定
// - prefersReducedMotion()：系统减少动效偏好探测（PL003，reduced 时快进落定）
// - bounce(refs)：落定冲击（PL003，coin 外层 scale 0.97→1 弹回，纯表现不动 rotateY）
// - onSwipe(ctx, refs, deltaX)：滑动加速 + 首次 toss 定本局结果 + 重置超时计时
// - settle(ctx, refs)：落定——展示结果、终局暴露 seed 与重置按钮；非终局停留后翻转回展示面
// - applyModeUI/onModeChange/bindModeButtons：模式互斥与按钮绑定
// - bindSlotDrag：选择器拖动吸附与联动回调
// - bindUI(ctx, refs)：全部交互绑定（模式/选择器/硬币滑动/成绩/设置/重置）
// - offsetOf(handle)：选择器轨道当前位移
// - init()：启动装配入口
// 设计理由：业务决策收拢装配层（参考项目同款），核心层纯函数零 IO；
//   结果先由 toss 计算、动画 guidedStep 精确落定（不弄虚作假、无角度差）；
//   落定/停留/翻转定时器句柄入 ctx，由 resetGame 统一清理防竞态污染；
//   错误入口统一页面提示不崩溃（降级不中断）
// 异常处理：配置加载/骨架缺失/模式非法 fail-fast 中文提示；运行期交互零崩溃
// 关联配置：config/rules.json、config/version.json、rules.js/game.js/coin.js/ui.js
