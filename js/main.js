// ============================================================
// 幸运硬币选择 - 启动装配与投掷编排（PL009 四季主题框架）
// 设计要点：装配层是唯一业务容器——加载配置 → 主题初始化（自动/手动）→
// 驱动 game（toss/setStatus）与 coin（tick/guidedStep）配合动画表现；
// 结果先由 toss 计算，动画只是落点表现不弄虚作假；每次落定记录战绩并持久化。
// 主题：默认跟随季节（3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬），手动选择持久化。
// 错误入口统一提示不崩溃（降级不中断，错误策略主线）。
// 关联配置：config/rules.json、config/version.json；关联模块 js/history.js、js/theme.js。
// ============================================================

import {
  validateRules,
  THEMES,
  DEFAULT_THEME,
  SEASONS,
  SEASON_THEMES,
  seasonOf,
} from "./rules.js";
import { createGame, toss, setStatus, STATUS } from "./game.js";
import { tick, guidedStep } from "./coin.js";
import {
  loadHistory,
  saveHistory,
  clearHistory,
  appendHistory,
} from "./history.js";
import { loadThemeState, saveThemeState } from "./theme.js";
import * as ui from "./ui.js";

// 解析配置 JSON 文本（装配层唯一解析入口）
export function parseConfig(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`配置文件「${label}」解析失败：${e.message}`);
  }
}

// 加载配置：fetch + parseConfig（网络/HTTP/解析三层错误分别中文提示）
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
    // 硬币皮肤主题（保留 gold/silver/anya；PL009 暂不暴露切换）
    theme: DEFAULT_THEME,
    // 场景主题（四季）：mode = "auto" | "manual"
    season: SEASONS.SPRING,
    seasonMode: "auto",
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
    seasonTimer: null,
  };
}

// 解析当前应用季节：manual 用已选季节，auto 用当前月份
// 输入：ctx；输出：季节枚举值
function resolveSeason(ctx) {
  if (ctx.seasonMode === "manual" && ctx.season) return ctx.season;
  return seasonOf(new Date());
}

// 应用季节主题：写入 data-season（CSS 换肤）并渲染标题装饰
// 输入：ctx、refs；输出：无
function applySeason(ctx, refs) {
  ctx.season = resolveSeason(ctx);
  ui.renderSeason(refs, ctx.season);
}

// 重置硬币与结果区（不触碰战绩记录）：清理定时器、硬币归位、展示面恢复
function resetGame(ctx, refs) {
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
  ui.renderCoinTheme(refs, THEMES[ctx.theme]);
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "yes");
  ui.setCoinShowFace(refs, THEMES[ctx.theme], "no");
  // 结果态复位（PL009）：隐藏丝带/彩纸屑/欢呼，提示回到待机文案
  ui.resetResult(refs);
}

// 动画主循环：自由衰减 + 落点引导（同 PL001-008 内核）
function frame(ctx, refs, now) {
  const dt = Math.min(50, now - ctx.lastT);
  ctx.lastT = now;

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

// prefers-reduced-motion 探测（PL003）
function prefersReducedMotion() {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// 落定冲击 bounce（PL003）
function bounce(refs) {
  refs.coinScene.classList.remove("coin-landed");
  void refs.coinScene.offsetWidth;
  refs.coinScene.classList.add("coin-landed");
}

// 滑动触发：叠加旋转速度、重置超时计时；首次滑动先 toss 定本次结果
function onSwipe(ctx, refs, deltaX) {
  if (ctx.settling) return;
  if (Math.abs(deltaX) < ctx.rules.swipeThreshold) return;
  if (!ctx.pending) {
    ctx.game = createGame(makeSeed());
    ctx.game = toss(ctx.game);
    ctx.pending = { face: ctx.game.lastFace };
    ctx.guiding = false;
    ctx.game = setStatus(ctx.game, STATUS.ROTATING);
    ui.renderCoinTheme(refs, THEMES[ctx.theme]);
    // 新一轮开始：收起上一轮的结果丝带与提示（PL009）
    ui.resetResult(refs);
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

// 落定：展示结果丝带 + 猫咪欢呼 + 彩纸屑（PL009），记录战绩；
// 结果面停留 resultHoldMs 后翻转回展示面，供下一次投掷。
function settle(ctx, refs) {
  if (!ctx.pending) return;
  ctx.settling = true;
  const resultFace = ctx.pending.face;
  ctx.pending = null;

  // 结果呈现（PL009）：丝带 YES/NO + 欢呼 + 彩纸屑 + 提示"再来一次"
  ui.showRibbon(refs, resultFace);
  ui.renderHint(refs, "再来一次 · 左右滑动");

  // 战绩记录（PL008）：追加置顶 + 持久化
  ctx.history = appendHistory(
    ctx.history,
    { at: Date.now(), face: resultFace },
    ctx.rules.historyLimit,
  );
  saveHistory(ctx.storage, ctx.history);

  ctx.holdId = setTimeout(() => {
    const which = resultFace === "yes" ? "no" : "yes";
    ui.setCoinShowFace(refs, THEMES[ctx.theme], which);
    ctx.angle += 180;
    refs.coin.style.transition = `transform ${ctx.rules.resetFlipMs}ms cubic-bezier(0.34, 1.4, 0.4, 1)`;
    ui.setCoinAngle(refs.coin, ctx.angle);
    ctx.flipId = setTimeout(() => {
      refs.coin.style.transition = "none";
      ctx.settling = false;
    }, ctx.rules.resetFlipMs + 60);
  }, ctx.rules.resultHoldMs);
}

// 绑定额外 UI 交互（战绩 / 换主题 / 硬币滑动）
function bindUI(ctx, refs) {
  // 硬币滑动
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

  // 战绩浮窗
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
    ui.showSheet(refs.overlay, "战绩", content);
  });

  // 换主题浮窗（PL009）：四季卡 + 自动跟随开关
  refs.settingsBtn.addEventListener("click", () => {
    if (!refs.overlay.hidden) {
      ui.hideOverlay(refs.overlay);
      return;
    }
    const openTheme = () => {
      const content = ui.buildThemeContent(
        ctx.season,
        ctx.seasonMode === "auto",
        (season) => {
          ctx.seasonMode = "manual";
          ctx.season = season;
          saveThemeState(ctx.storage, {
            mode: ctx.seasonMode,
            season: ctx.season,
          });
          applySeason(ctx, refs);
          openTheme(); // 重开以刷新选中态
        },
        (autoOn) => {
          ctx.seasonMode = autoOn ? "auto" : "manual";
          if (autoOn) ctx.season = seasonOf(new Date());
          saveThemeState(ctx.storage, {
            mode: ctx.seasonMode,
            season: ctx.season,
          });
          applySeason(ctx, refs);
          openTheme();
        },
      );
      ui.showSheet(refs.overlay, "换主题", content);
    };
    openTheme();
  });
}

// 启动入口：加载配置 → 主题初始化 → 装配 UI
export async function init() {
  let ctx;
  try {
    const { rules, version } = await bootstrap();
    const refs = ui.collectRefs();
    ctx = createCtx(rules, version);
    ctx.refs = refs;
    ctx.storage = typeof localStorage !== "undefined" ? localStorage : null;

    // 主题状态（PL009）：持久化优先；否则按 config 默认（auto/manual）
    const saved = loadThemeState(ctx.storage);
    if (saved) {
      ctx.seasonMode = saved.mode;
      ctx.season = saved.season ?? seasonOf(new Date());
    } else {
      ctx.seasonMode = rules.themeAutoDefault ? "auto" : "manual";
      ctx.season = seasonOf(new Date());
      saveThemeState(ctx.storage, {
        mode: ctx.seasonMode,
        season: ctx.season,
      });
    }
    applySeason(ctx, refs);

    // 战绩载入（PL008）
    ctx.history = loadHistory(ctx.storage);
    resetGame(ctx, refs);

    // 硬币立体化（PL002）
    const cs = getComputedStyle(document.documentElement);
    const segN = parseInt(cs.getPropertyValue("--coin-seg")) || 24;
    const coinSize = refs.coin.offsetWidth || 240;
    const thick = parseFloat(cs.getPropertyValue("--coin-thick")) || 10;
    ui.buildCoinEdge(refs.coin, segN, coinSize / 2, thick);
    bindUI(ctx, refs);

    // 自动模式季节巡检（每分钟一次；跨季节时自动换肤）
    ctx.seasonTimer = setInterval(() => {
      if (ctx.seasonMode !== "auto") return;
      const next = seasonOf(new Date());
      if (next !== ctx.season) {
        ctx.season = next;
        applySeason(ctx, refs);
        saveThemeState(ctx.storage, { mode: "auto", season: next });
      }
    }, 60 * 1000);
  } catch (e) {
    const bar = document.createElement("div");
    bar.textContent = String(e.message);
    bar.style.cssText =
      "position:fixed;inset:auto 0 0 0;padding:14px;background:#ef476f;color:#fff;z-index:99";
    document.body.appendChild(bar);
  }
  return ctx;
}

// 浏览器环境启动装配（node 无头 import 时不启动）
if (typeof window !== "undefined" && typeof document !== "undefined") {
  init();
}

// ===== js/main.js 模块说明 =====
// 函数清单与逻辑：
// - parseConfig/loadJson/bootstrap：配置加载契约（装配层唯一 IO 入口）
// - makeSeed()：生成投掷 seed（随机，结果可复现）
// - createCtx(rules, version)：编排上下文（含硬币皮肤、场景季节、战绩、storage）
// - resolveSeason/applySeason：季节解析（manual 用已选 / auto 按月份）与应用（data-season）
// - resetGame(ctx, refs)：重置硬币与结果区（不触碰战绩；隐藏丝带/欢呼/彩纸屑）
// - frame：动画主循环——自由衰减 + 落点引导 guidedStep 精确落定
// - prefersReducedMotion/bounce：减少动效探测 / 落定冲击
// - onSwipe：滑动加速 + toss 定结果 + 新一轮收起上一轮结果态
// - settle：结果丝带 + 猫咪欢呼 + 彩纸屑 + 战绩记录 + 停留后翻转回展示面
// - bindUI：交互绑定（硬币滑动 / 战绩浮窗 / 换主题浮窗）
// - init：启动装配入口（主题初始化 + 自动巡检）
// 设计理由：业务决策收拢装配层，核心层纯函数零 IO；PL009 增加四季主题，
//   自动/手动模式持久化，跨季节每分钟巡检；结果呈现与战绩记录解耦
// 异常处理：配置加载/骨架缺失/契约失败 fail-fast 中文提示；运行期交互零崩溃
// 关联配置：config/rules.json、config/version.json、rules.js/game.js/coin.js/ui.js/history.js/theme.js
