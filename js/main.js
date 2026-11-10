// ============================================================
// 幸运硬币选择 - 启动装配与投掷编排（PL008 单次投掷）
// 设计要点：装配层是唯一业务容器——加载配置 → 装配 UI → 驱动
// game（toss/setStatus）与 coin（tick/guidedStep）配合动画表现；
// 结果先由 toss 计算，动画只是落点表现不弄虚作假；每次落定即记录战绩
// （日期时间 + yes/no，localStorage 持久化，不自动清零）。
// 错误入口统一提示不崩溃（降级不中断，错误策略主线）。
// 关联配置：config/rules.json、config/version.json；关联模块 js/history.js。
// ============================================================

import { validateRules, THEMES, DEFAULT_THEME } from "./rules.js";
import { createGame, toss, setStatus, STATUS } from "./game.js";
import { tick, guidedStep } from "./coin.js";
import {
  loadHistory,
  saveHistory,
  clearHistory,
  appendHistory,
} from "./history.js";
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

// 生成投掷 seed（随机生成；同 seed 可复现单次结果）
function makeSeed() {
  return `coin-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// 投掷编排上下文（单例，由 init 创建）
function createCtx(rules, version) {
  return {
    rules,
    version,
    game: null,
    theme: DEFAULT_THEME,
    history: [],
    storage: null,
    velocity: 0,
    angle: 0,
    pending: null,
    settling: false,
    guiding: false,
    idleTimer: null,
    holdId: null,
    flipId: null,
    rafId: null,
    lastT: 0,
  };
}

// 重置硬币与结果区（不触碰战绩记录）：清理定时器、硬币归位、展示面恢复
// 输入：ctx 编排上下文、refs；输出：无
function resetGame(ctx, refs) {
  // 清理残留定时器：防旧落定/停留/翻转回调污染新一轮
  clearTimeout(ctx.idleTimer);
  clearTimeout(ctx.holdId);
  clearTimeout(ctx.flipId);
  ctx.idleTimer = null;
  ctx.holdId = null;
  ctx.flipId = null;
  ctx.game = createGame(makeSeed());
  ctx.pending = null;
  ctx.settling = false;
  ctx.guiding = false;
  ctx.velocity = 0;
  ctx.angle = 0;
  ui.setCoinAngle(refs.coin, 0);
  // 壁色/齿环色随主题（PL002）：renderCoinTheme 设面与壁色，随后覆盖两面为展示面
  ui.renderCoinTheme(refs, THEMES[ctx.theme]);
  // 初始/重置无结果，双面均为展示面
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "yes");
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "no");
  // 待机引导（PL008）：结果区小字提示，落定结果覆盖
  ui.renderIdleHint(refs.roundResult, "左右滑动 · 抛硬币");
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

// 滑动触发：叠加旋转速度、重置超时计时；首次滑动先 toss 定本次结果
// 输入：ctx、refs、deltaX 本次滑动位移；输出：无
function onSwipe(ctx, refs, deltaX) {
  // 落定展示期间忽略滑动，避免打断落定动画/重复记录
  if (ctx.settling) return;
  // 横向位移不足（含纯垂直滑动）不视为抛硬币手势，避免误触出结果
  if (Math.abs(deltaX) < ctx.rules.swipeThreshold) return;
  if (!ctx.pending) {
    // 每次投掷独立快照（新 seed），toss 一次即出结果（PL008）
    ctx.game = createGame(makeSeed());
    ctx.game = toss(ctx.game);
    ctx.pending = { face: ctx.game.lastFace };
    // 新一轮抛掷复位引导锁：上一轮落定后 guiding 残留 true 会让本轮跳过
    // 自由衰减直接进入落点引导，导致只能微幅旋转一个翻面就落定
    ctx.guiding = false;
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

// 落定：展示本次结果（大字弹入）+ 记录战绩（日期时间 + yes/no）；
// 结果面停留 resultHoldMs 后翻转回展示面，供下一次投掷。
// 定时器句柄存 ctx（holdId/flipId），由 resetGame 统一清理防竞态。
// 输入：ctx、refs；输出：无
function settle(ctx, refs) {
  if (!ctx.pending) return;
  ctx.settling = true;
  const resultFace = ctx.pending.face;
  const faceText = resultFace === "yes" ? "YES" : "NO";
  ctx.pending = null;

  // 结果展示（PL007.4b：32px 戏剧字号 + 弹入）
  ui.renderRoundResult(refs.roundResult, faceText);
  // 战绩记录（PL008）：追加置顶 + 持久化（存储异常静默降级为会话内）
  ctx.history = appendHistory(
    ctx.history,
    { at: Date.now(), face: resultFace },
    ctx.rules.historyLimit,
  );
  saveHistory(ctx.storage, ctx.history);

  // 结果面停留后翻转回展示面（下一次投掷）
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

// 绑定所有 UI 交互（硬币滑动 / 战绩 / 换硬币）
// 输入：ctx、refs；输出：无
function bindUI(ctx, refs) {
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

  // 战绩浮层（PL008）：打开时按当前记录渲染；清除按钮二次确认
  refs.historyBtn.addEventListener("click", () => {
    if (!refs.overlay.hidden) {
      ui.hideOverlay(refs.overlay);
      return;
    }
    const content = ui.buildHistoryContent(
      ctx.history,
      () => {
        ctx.history = [];
        clearHistory(ctx.storage);
        return ctx.history;
      },
      ctx.rules.clearConfirmMs,
    );
    ui.showOverlayCard(refs.overlay, "战绩", content);
  });

  // 换硬币浮层（主题切换）
  refs.settingsBtn.addEventListener("click", () => {
    if (!refs.overlay.hidden) {
      ui.hideOverlay(refs.overlay);
      return;
    }
    const content = ui.buildSettingsContent(ctx.theme, (name) => {
      ctx.theme = name;
      // 切主题统一渲染 yes/no 双面（所有主题同一逻辑）
      ui.renderCoinTheme(refs, THEMES[name]);
      for (const btn of content.querySelectorAll(".theme-option")) {
        btn.classList.toggle("active", btn.dataset.theme === name);
      }
    });
    ui.showOverlayCard(refs.overlay, "更换硬币", content);
  });
}

// 启动入口：加载配置 → 装入战绩 → 装配 UI
// 输入：无；输出：Promise
// 异常：配置/骨架任一失败 → 页面提示区展示中文错误，不崩溃
export async function init() {
  let ctx;
  try {
    const { rules, version } = await bootstrap();
    const refs = ui.collectRefs();
    ctx = createCtx(rules, version);
    ctx.refs = refs;
    // 战绩持久化（PL008）：localStorage 不可用时降级为会话内记录
    ctx.storage = typeof localStorage !== "undefined" ? localStorage : null;
    ctx.history = loadHistory(ctx.storage);
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
// 输入：无；输出：无（启动后由 DOM 事件驱动投掷）
if (typeof window !== "undefined" && typeof document !== "undefined") {
  init();
}

// ===== js/main.js 模块说明 =====
// 函数清单与逻辑：
// - parseConfig/loadJson/bootstrap：配置加载契约（装配层唯一 IO 入口）
// - makeSeed()：生成投掷 seed（随机，结果可复现）
// - createCtx(rules, version)：投掷编排上下文（含战绩数组与 storage 注入）
// - resetGame(ctx, refs)：重置硬币与结果区（清理定时器；不触碰战绩）
// - frame(ctx, refs, now)：动画主循环——自由衰减 + 落点引导 guidedStep 精确落定
// - prefersReducedMotion()：系统减少动效偏好探测（PL003，reduced 时快进落定）
// - bounce(refs)：落定冲击（PL003，coin 外层 scale 0.97→1 弹回）
// - onSwipe(ctx, refs, deltaX)：滑动加速 + 首次 toss 定结果 + 重置超时计时
// - settle(ctx, refs)：落定——展示结果、记录战绩（置顶 + 持久化）、停留后翻转回展示面
// - bindUI(ctx, refs)：交互绑定（硬币滑动 / 战绩浮层 / 换硬币浮层）
// - init()：启动装配入口
// 设计理由：业务决策收拢装配层，核心层纯函数零 IO；结果先由 toss 计算、
//   动画 guidedStep 精确落定（不弄虚作假、无角度差）；PL008 删除多局编排后
//   每次落定即记录战绩并持久化，刷新/重开不丢；存储异常降级为会话内记录
// 异常处理：配置加载/骨架缺失/契约失败 fail-fast 中文提示；运行期交互零崩溃
// 关联配置：config/rules.json、config/version.json、rules.js/game.js/coin.js/ui.js/history.js
