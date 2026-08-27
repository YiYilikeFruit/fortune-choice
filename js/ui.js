// ============================================================
// 幸运硬币选择 - 渲染层（DOM 构建与刷新，只读不改业务状态）
// 设计要点：模式互斥/定数联动/中文数字为纯函数（无头可测）；
// collectRefs 收拢骨架元素引用；业务决策留在装配层（main.js）。
// 关联配置：rules.js 主题/模式；coin.js 三面角。
// ============================================================

import { THEMES, DEFAULT_THEME } from "./rules.js";
import { FACE_ANGLES } from "./coin.js";

// 中文数字：索引 0 = 一，对应数字 1
export const CN_DIGITS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

// 自定义模式局数可选范围：[2, 9]
export const PICKER_MIN = 2;
export const PICKER_MAX = 9;

// 数字 → 中文显示
// 输入：n 数字 1-9；输出：中文数字字符串
export function cnDigit(n) {
  return CN_DIGITS[n - 1] ?? String(n);
}

// 模式互斥状态机（纯函数）：再按已选中取消，切换选中
// 输入：current 当前选中模式（null 或 MODES 值）、target 点击的模式
// 输出：新选中模式（null 表示无按钮按下 = 一局定输赢）
export function nextModeState(current, target) {
  return current === target ? null : target;
}

// 自定义定数可用范围联动（纯函数）：X 选定时，Y ∈ [PICKER_MIN, x]
// 输入：x 局数；输出：{ lo, hi }
export function yRangeFor(x) {
  const lo = PICKER_MIN;
  const hi = Math.max(lo, Math.min(PICKER_MAX, x));
  return { lo, hi };
}

// 收集页面骨架关键元素引用（main.js 启动时调用一次）
// 输入：doc 文档对象（默认全局 document，便于无头 stub 测缺失路径）
// 输出：refs 对象供全部渲染/绑定函数使用
// 异常：任一关键节点缺失抛中文错误（骨架与脚本版本失配早暴露）
export function collectRefs(doc = document) {
  const byId = (id) => doc.getElementById(id);
  // 骨架必填节点（按真实 id 报告缺失，便于对照 index.html）
  const REQUIRED_IDS = [
    "mode-buttons",
    "custom-picker",
    "slot-x",
    "slot-y",
    "swipe-hint",
    "coin-stage",
    "coin",
    "round-result",
    "progress",
    "reset-btn",
    "score-btn",
    "settings-btn",
    "overlay",
    "toast",
  ];
  for (const id of REQUIRED_IDS) {
    if (!byId(id)) {
      throw new Error(`页面骨架缺少节点 #${id}，请核对 index.html`);
    }
  }
  const coin = byId("coin");
  const refs = {
    modeButtons: byId("mode-buttons"),
    picker: byId("custom-picker"),
    slotX: byId("slot-x"),
    slotY: byId("slot-y"),
    swipeHint: byId("swipe-hint"),
    coinStage: byId("coin-stage"),
    coin,
    faces: {
      yes: coin ? coin.querySelector(".face-yes") : null,
      no: coin ? coin.querySelector(".face-no") : null,
    },
    roundResult: byId("round-result"),
    progress: byId("progress"),
    resetBtn: byId("reset-btn"),
    scoreBtn: byId("score-btn"),
    settingsBtn: byId("settings-btn"),
    overlay: byId("overlay"),
    toast: byId("toast"),
  };
  for (const [name, el] of Object.entries(refs)) {
    if (!el) {
      throw new Error(`页面骨架缺少节点 #${name}，请核对 index.html`);
    }
  }
  for (const [face, el] of Object.entries(refs.faces)) {
    if (!el) {
      throw new Error(`页面骨架缺少硬币面 .face-${face}，请核对 index.html`);
    }
  }
  return refs;
}

// 构建单个滑动选择器（slot 内的数字条）
// 输入：slotEl 容器、values 可选数字数组（默认 1-9）；输出：选择器句柄 { setIndex, getValue, setDisabled }
// 行为：构建 .slot-track 内 9 个 .slot-item，滚动吸附由句柄方法驱动（事件绑定在 bindUI）
export function buildSlot(slotEl) {
  const track = document.createElement("div");
  track.className = "slot-track";
  slotEl.appendChild(track);
  const itemW = 44;
  const items = [];
  for (let i = PICKER_MIN; i <= PICKER_MAX; i++) {
    const item = document.createElement("div");
    item.className = "slot-item";
    item.dataset.value = String(i);
    item.textContent = cnDigit(i);
    track.appendChild(item);
    items.push(item);
  }

  const centerOffset = () => (slotEl.clientWidth - itemW) / 2;

  // 设置选中索引（0 基，对应数字 PICKER_MIN+i），联动 track 位移
  const setIndex = (idx, selectedMap = null) => {
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    track.style.transform = `translateX(${centerOffset() - clamped * itemW}px)`;
    items.forEach((item, i) => {
      const selected = i === clamped;
      item.classList.toggle("selected", selected);
      const disabled = selectedMap ? !selectedMap.has(i) : false;
      item.classList.toggle("disabled", disabled);
    });
    return clamped;
  };

  // 以 translateX 像素偏移驱动轨道（拖动中）
  const setOffset = (px) => {
    track.style.transform = `translateX(${px}px)`;
  };

  // 由当前轨道位移吸附出最近索引
  const snapFromOffset = (px) => {
    const target = centerOffset() - px;
    const idx = Math.round(target / itemW);
    return Math.max(0, Math.min(items.length - 1, idx));
  };

  return {
    track,
    itemW,
    items,
    setIndex,
    setOffset,
    snapFromOffset,
    getValue: () =>
      PICKER_MIN +
      snapFromOffset(
        parseFloat(track.style.transform.replace(/[^0-9.-]/g, "")) ||
          centerOffset(),
      ),
  };
}

// 渲染硬币主题：双面 emoji + 展示面（旋转前硬币本体即展示面）
// 输入：refs（含 faces.yes/no）、theme 主题对象；输出：无
export function renderCoinTheme(refs, theme) {
  refs.faces.yes.textContent = theme.faces.yes;
  refs.faces.no.textContent = theme.faces.no;
  refs.faces.yes.style.setProperty("--coin-face-yes", theme.color);
  refs.faces.no.style.setProperty("--coin-face-no", theme.color);
}

// 设置硬币指定面为展示面（待机态该面显示封面；转回时只改翻转后将朝前的背面）
// 输入：refs（含 faces.yes/no）、theme 主题对象、which（"yes"|"no" 目标面）；输出：无
export function setCoinShowFace(refs, theme, which) {
  refs.faces[which].textContent = theme.faces.show;
  refs.faces[which].style.setProperty(`--coin-face-${which}`, theme.color);
}

// 设置硬币旋转角（绕 Y 轴，度）
// 输入：coinEl、angle；输出：无
export function setCoinAngle(coinEl, angle) {
  coinEl.style.transform = `rotateY(${angle}deg)`;
}

// 渲染单局/终局结果文字
// 输入：el、text、isFinal；输出：无
export function renderRoundResult(el, text, isFinal = false) {
  el.textContent = text;
  el.classList.toggle("final", isFinal);
}

// 渲染进度指示
export function renderProgress(el, text) {
  el.textContent = text;
}

// 显示/隐藏重置按钮（仅终局出现）
export function showReset(el, show) {
  el.classList.toggle("hidden", !show);
}

// 构建浮层卡片内容并显示
// 输入：overlay 容器、title、contentEl 已构建内容节点；输出：无
export function showOverlayCard(overlay, title, contentEl) {
  const card = document.createElement("div");
  card.className = "overlay-card";
  const h = document.createElement("h3");
  h.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "overlay-close";
  close.textContent = "关闭";
  card.append(h, contentEl, close);
  overlay.innerHTML = "";
  overlay.appendChild(card);
  overlay.hidden = false;
  close.addEventListener("click", () => hideOverlay(overlay));
  return card;
}

// 隐藏浮层
export function hideOverlay(overlay) {
  overlay.hidden = true;
  overlay.innerHTML = "";
}

// 轻提示（超时提醒等）
// 输入：toast 元素、text；输出：无（1.8s 后自动隐藏）
export function showToast(toast, text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

// 构建成绩浮层内容：本轮全部局结果列表（会话内）
// 输入：score 数组（[{round, face}]）；输出：内容节点
export function buildScoreContent(score) {
  const list = document.createElement("ul");
  list.className = "score-list";
  if (score.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无记录";
    list.appendChild(li);
  } else {
    for (const item of score) {
      const li = document.createElement("li");
      const no = document.createElement("span");
      no.className = "no";
      no.textContent = `第${item.round}局`;
      const face = document.createElement("span");
      face.className = "result-face";
      face.textContent = item.face === "yes" ? "✅" : "❌";
      li.append(no, face);
      list.appendChild(li);
    }
  }
  return list;
}

// 构建设置浮层内容：硬币主题切换（2 套）
// 输入：currentTheme 当前主题名、onChange 回调；输出：内容节点
export function buildSettingsContent(currentTheme, onChange) {
  const box = document.createElement("div");
  box.className = "theme-options";
  for (const [name, theme] of Object.entries(THEMES)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-option";
    btn.dataset.theme = name;
    btn.textContent = `${theme.faces.show} ${theme.name}`;
    btn.classList.toggle("active", name === currentTheme);
    btn.addEventListener("click", () => onChange(name));
    box.appendChild(btn);
  }
  return box;
}

// ===== js/ui.js 模块说明 =====
// 常量与函数清单：
// - CN_DIGITS：中文数字表；PICKER_MIN/MAX：自定义局数范围 [2,9]
// - cnDigit(n)：数字→中文；nextModeState(current,target)：模式互斥状态机（纯函数）
// - yRangeFor(x)：定数可用范围联动（纯函数）
// - collectRefs(doc)：骨架元素引用收集，缺失 fail-fast
// - buildSlot(slotEl)：构建滑动选择器，返回轨道/吸附/取值句柄
// - renderCoinTheme / setCoinShowFace / setCoinAngle：硬币渲染
// - renderRoundResult / renderProgress / showReset：结果区
// - showOverlayCard / hideOverlay / showToast：浮层与提示
// - buildScoreContent / buildSettingsContent：成绩/设置浮层内容构建
// 设计理由：渲染层只画快照不改业务状态（装配层 main.js 是唯一业务容器）；
//   纯函数内核（模式互斥/定数联动）无头可测，DOM 表现层由浏览器冒烟覆盖
// 异常处理：collectRefs 骨架缺失 fail-fast；其余渲染路径零异常不中断
// 关联配置：rules.js THEMES/DEFAULT_THEME、coin.js FACE_ANGLES；消费方 main.js
