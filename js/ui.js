// ============================================================
// 幸运硬币选择 - 渲染层（DOM 构建与刷新，只读不改业务状态）
// 设计要点：战绩时间格式化/列表渲染为纯函数（无头可测）；
// collectRefs 收拢骨架元素引用；业务决策留在装配层（main.js）。
// 关联配置：rules.js 主题；coin.js 双面角；history 记录结构（PL008）。
// ============================================================

import { THEMES, DEFAULT_THEME } from "./rules.js";
import { embossImage } from "./emboss.js";

// 收集页面骨架关键元素引用（main.js 启动时调用一次）
// 输入：doc 文档对象（默认全局 document，便于无头 stub 测缺失路径）
// 输出：refs 对象供全部渲染/绑定函数使用
// 异常：任一关键节点缺失抛中文错误（骨架与脚本版本失配早暴露）
export function collectRefs(doc = document) {
  const byId = (id) => doc.getElementById(id);
  // 骨架必填节点（按真实 id 报告缺失，便于对照 index.html）
  const REQUIRED_IDS = [
    "title-bar",
    "swipe-hint",
    "coin-stage",
    "coin-scene",
    "coin",
    "round-result",
    "history-btn",
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
    titleBar: byId("title-bar"),
    swipeHint: byId("swipe-hint"),
    coinStage: byId("coin-stage"),
    coinScene: byId("coin-scene"),
    coin,
    faces: {
      yes: coin ? coin.querySelector(".face-yes") : null,
      no: coin ? coin.querySelector(".face-no") : null,
    },
    roundResult: byId("round-result"),
    historyBtn: byId("history-btn"),
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

// 颜色加深/减淡：hex → rgb 按系数缩放（齿环暗色等派生色用）
// 输入：hex "#rrggbb"、factor 缩放系数（0-1）；输出：派生 hex
// 异常：非法 hex 原样返回（渲染兜底不中断）
function shadeHex(hex, factor) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// 构建硬币侧面圆柱壁（PL002）：n 个窄条绕 Y 轴环排近似圆筒，滚花/金属渐变在 CSS
// 输入：coinEl 硬币容器、n 分段数、radius 半径（px，取 --coin-size/2）、thick 厚度（px）、doc 文档对象
// 输出：seg 元素数组（已挂载到 .coin-edge 内）
// 异常：n/radius/thick 非有限 → 中文 fail-fast
export function buildCoinEdge(coinEl, n, radius, thick, doc = document) {
  if (
    !Number.isFinite(n) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(thick)
  ) {
    throw new Error(
      `圆柱壁参数必须为有限数字，收到：n=${n} radius=${radius} thick=${thick}`,
    );
  }
  const arc = (2 * Math.PI * radius) / n;
  const edge = doc.createElement("div");
  edge.className = "coin-edge";
  // 每段弧长写入 CSS 变量，供滚花条纹（每段 2 齿、与正面齿环一一对应）取实际半径值
  edge.style.setProperty("--seg-arc", `${arc}px`);
  coinEl.appendChild(edge);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const seg = doc.createElement("div");
    seg.className = "edge-seg";
    seg.style.width = `${arc}px`;
    seg.style.height = `${thick}px`;
    // 负 margin 把元素中心对准容器中心（left:50% top:50% 只对齐左上角），
    // 保证 translateZ(R) 从硬币中心沿半径外移，圆环与两面同心对齐
    seg.style.marginLeft = `${-arc / 2}px`;
    seg.style.marginTop = `${-thick / 2}px`;
    seg.style.transform = `rotateY(${(i * 360) / n}deg) translateZ(${radius}px)`;
    edge.appendChild(seg);
    segs.push(seg);
  }
  return segs;
}

// 构建币面固定层（PL004）：face 内按序创建内容标记容器 .coin-face-mark、
// 金属光泽 .coin-shine、内 rim .coin-rim（仅一次，之后只更新标记内容，保证层序稳定）
// 输入：faceEl 面元素；输出：mark 容器（文字/图片放其中）
function _ensureFaceLayers(faceEl) {
  let mark = faceEl.querySelector(".coin-face-mark");
  if (!mark) {
    mark = document.createElement("div");
    mark.className = "coin-face-mark";
    faceEl.appendChild(mark);
    const shine = document.createElement("div");
    shine.className = "coin-shine";
    faceEl.appendChild(shine);
    const rimShadow = document.createElement("div");
    rimShadow.className = "coin-rim-shadow";
    faceEl.appendChild(rimShadow);
    const rim = document.createElement("div");
    rim.className = "coin-rim";
    faceEl.appendChild(rim);
    const junction = document.createElement("div");
    junction.className = "coin-junction";
    faceEl.appendChild(junction);
  }
  return mark;
}

// 设置硬币面标记（PL004/PL007）：清空标记容器后按 faces 值类型分派——
// 图片路径（.png/.jpg/.jpeg/.webp）→ img.coin-face-img（PL005 浮雕化）；
// 文字标记 → span.face-mark（单字符放大）
// 输入：faceEl 面元素、text 文字或图片路径；输出：无（层序由 _ensureFaceLayers 保证）
function _setFaceMark(faceEl, text) {
  const mark = _ensureFaceLayers(faceEl);
  mark.textContent = "";
  const isImg = typeof text === "string" && /\.(png|jpe?g|webp)$/i.test(text);
  if (isImg) {
    const img = document.createElement("img");
    img.className = "coin-face-img";
    img.alt = "";
    mark.appendChild(img);
    // 浮雕化（PL005 方案 A）：图片加载后按明暗预渲染凹凸，失败降级保留原图
    img.onload = () => {
      if (img.dataset.embossed) return;
      img.dataset.embossed = "1";
      try {
        const url = embossImage(img);
        if (url && img.isConnected) img.src = url;
      } catch (err) {
        // 保留原图（不能因浮雕失败让币面空白）
      }
    };
    img.src = text;
  } else {
    const span = document.createElement("span");
    span.className = "face-mark";
    // 单字符标记（PL007.3 show 面「运」）放大字号，多字符 YES/NO 用默认小字号
    if (typeof text === "string" && text.length <= 1) {
      span.classList.add("single");
    }
    span.textContent = text;
    mark.appendChild(span);
  }
}

// 渲染硬币主题：双面文字标记 + 材质 palette（面片/倒角/齿环取色）+ 侧面壁色
// 输入：refs（含 faces.yes/no、coin）、theme 主题对象；输出：无
// 说明（PL003）：palette 五色写入 #coin 容器（子面片继承），金暖银冷光谱
export function renderCoinTheme(refs, theme) {
  _setFaceMark(refs.faces.yes, theme.faces.yes);
  _setFaceMark(refs.faces.no, theme.faces.no);
  refs.faces.yes.style.setProperty("--coin-face-yes", theme.color);
  refs.faces.no.style.setProperty("--coin-face-no", theme.color);
  // 材质 palette（PL003）：金/银光谱写入 #coin 容器，面片多层渐变/倒角/齿环引用
  const p = theme.palette;
  refs.coin.style.setProperty("--coin-pal-hi", p.hi);
  refs.coin.style.setProperty("--coin-pal-light", p.light);
  refs.coin.style.setProperty("--coin-pal-base", p.base);
  refs.coin.style.setProperty("--coin-pal-dark", p.dark);
  refs.coin.style.setProperty("--coin-pal-deep", p.deep);
  // 侧面壁色 = 主题色；齿环暗色 = 主题色加深（PL002）
  refs.coin.style.setProperty("--coin-edge", theme.color);
  refs.coin.style.setProperty("--coin-rim-hi", theme.color);
  refs.coin.style.setProperty("--coin-rim-lo", shadeHex(theme.color, 0.62));
}

// 设置硬币指定面为展示面（待机态该面显示封面；转回时只改翻转后将朝前的背面）
// 输入：refs（含 faces.yes/no）、theme 主题对象、which（"yes"|"no" 目标面）；输出：无
export function setCoinShowFace(refs, theme, which) {
  _setFaceMark(refs.faces[which], theme.faces.show);
  refs.faces[which].style.setProperty(`--coin-face-${which}`, theme.color);
}

// 设置硬币旋转角（绕 Y 轴，度）
// 输入：coinEl、angle；输出：无
export function setCoinAngle(coinEl, angle) {
  coinEl.style.transform = `rotateY(${angle}deg)`;
}

// 渲染待机引导（PL008 文案）：小字弱化显示，落定结果覆盖
// 输入：el 结果文字元素、text 文案；输出：无
export function renderIdleHint(el, text) {
  el.textContent = text;
  el.classList.remove("final", "pop");
  el.classList.add("idle");
}

// 渲染投掷结果文字（PL007.4b：落定弹入动画，reduced-motion 由 CSS 关闭）
// 输入：el、text、isFinal；输出：无
export function renderRoundResult(el, text, isFinal = false) {
  el.textContent = text;
  el.classList.remove("idle", "final", "pop");
  el.classList.toggle("final", isFinal);
  // 重触发弹入：先移除再强制 reflow（与 bounce 同手法）
  void el.offsetWidth;
  el.classList.add("pop");
}

// 战绩时间格式化（PL008，纯函数）：同年 MM-DD HH:mm，跨年 YYYY-MM-DD HH:mm
// 输入：at 毫秒时间戳、now 参照时间（默认当前）；输出：格式化字符串（24 小时制零填充）
export function formatHistoryTime(at, now = Date.now()) {
  const d = new Date(at);
  const n = new Date(now);
  const pad = (v) => String(v).padStart(2, "0");
  const date =
    d.getFullYear() === n.getFullYear()
      ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 渲染战绩列表（PL008，纯渲染）：时间 + 金/银圆点 + YES/NO；空态「暂无战绩」
// 输入：el 列表容器（ul）、records 记录数组（最新在上）、now 参照时间；输出：无
export function renderHistoryList(el, records, now = Date.now()) {
  el.textContent = "";
  if (records.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "暂无战绩";
    el.appendChild(empty);
    return;
  }
  for (const item of records) {
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = formatHistoryTime(item.at, now);
    const dot = document.createElement("span");
    dot.className =
      item.face === "yes" ? "score-dot dot-yes" : "score-dot dot-no";
    const face = document.createElement("span");
    face.className = "result-face";
    face.textContent = item.face === "yes" ? "YES" : "NO";
    li.append(time, dot, face);
    el.appendChild(li);
  }
}

// 构建战绩浮层内容（PL008）：列表 + 清除按钮（二次确认；confirmMs 内未再按恢复）
// 输入：records 记录数组、onClear 清零回调（返回剩余记录）、confirmMs 确认窗口；输出：内容节点
export function buildHistoryContent(records, onClear, confirmMs = 3000) {
  const box = document.createElement("div");
  box.className = "history-box";
  const list = document.createElement("ul");
  list.className = "history-list";
  renderHistoryList(list, records);
  box.appendChild(list);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "history-clear";
  clearBtn.textContent = "清除全部战绩";
  let armed = false;
  let timer = null;
  const disarm = () => {
    armed = false;
    clearTimeout(timer);
    timer = null;
    clearBtn.classList.remove("armed");
    clearBtn.textContent = "清除全部战绩";
  };
  clearBtn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      clearBtn.classList.add("armed");
      clearBtn.textContent = "再按一次确认";
      clearTimeout(timer);
      timer = setTimeout(disarm, confirmMs);
      return;
    }
    disarm();
    const remaining = onClear();
    renderHistoryList(list, Array.isArray(remaining) ? remaining : []);
  });
  box.appendChild(clearBtn);
  return box;
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

// 构建设置浮层内容：硬币主题切换（PL007.3：色点 + 名称，零 emoji）
// 输入：currentTheme 当前主题名、onChange 回调；输出：内容节点
export function buildSettingsContent(currentTheme, onChange) {
  const box = document.createElement("div");
  box.className = "theme-options";
  for (const [name, theme] of Object.entries(THEMES)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-option";
    btn.dataset.theme = name;
    // 主题色圆点前置（替代原 faces.show emoji 拼接）
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.style.background = theme.color;
    const label = document.createElement("span");
    label.textContent = theme.name;
    btn.append(swatch, label);
    btn.classList.toggle("active", name === currentTheme);
    btn.addEventListener("click", () => onChange(name));
    box.appendChild(btn);
  }
  return box;
}

// ===== js/ui.js 模块说明 =====
// 函数清单：
// - collectRefs(doc)：骨架元素引用收集（含 title-bar/history-btn），缺失 fail-fast
// - buildCoinEdge(coinEl,n,radius,thick)：构建圆柱侧面壁（PL002，写 --seg-arc）
// - shadeHex(hex,factor)：派生加深色（齿环暗色等，PL002）
// - _setFaceMark(faceEl,text)：面标记分派（文字→span / 图片路径→img，PL004/PL007）
// - renderCoinTheme / setCoinShowFace / setCoinAngle：硬币渲染（palette 写变量，PL003）
// - renderIdleHint / renderRoundResult：待机引导弱化显示 / 结果文字落定弹入（PL007.4b）
// - formatHistoryTime(at,now)：战绩时间格式化（同年 MM-DD HH:mm / 跨年带年份，纯函数）
// - renderHistoryList(el,records,now)：战绩列表渲染（时间 + 圆点 + YES/NO，空态）
// - buildHistoryContent(records,onClear,confirmMs)：战绩浮层内容（清除按钮二次确认）
// - showOverlayCard / hideOverlay / showToast：浮层与提示
// - buildSettingsContent：设置浮层内容（色点 + 名称，PL007.3）
// 设计理由：渲染层只画快照不改业务状态（装配层 main.js 是唯一业务容器）；
//   时间格式化/列表渲染纯函数无头可测；PL008 删除多局后移除模式/选择器/比分渲染
// 异常处理：collectRefs 骨架缺失 fail-fast；其余渲染路径零异常不中断
// 关联配置：rules.js THEMES/DEFAULT_THEME、coin.js 双面角、history 记录结构；消费方 main.js
