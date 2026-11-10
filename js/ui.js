// ============================================================
// 幸运硬币选择 - 渲染层（PL009 四季主题框架）
// 设计要点：主题/结果态/战绩/主题浮窗为渲染职责，业务决策留在 main.js；
// 纯函数（时间格式化）无头可测；硬币渲染保留 PL002-007 体系。
// 关联配置：rules.js SEASONS/SEASON_THEMES/THEMES；coin.js 双面角。
// ============================================================

import { THEMES, DEFAULT_THEME } from "./rules.js";
import { embossImage } from "./emboss.js";

// 季节装饰 SVG（标题左上角，纯展示）
const SEASON_DECO = {
  spring:
    '<svg viewBox="0 0 46 46"><g fill="#f6b8cc"><circle cx="23" cy="10" r="8"/><circle cx="36" cy="19" r="8"/><circle cx="32" cy="34" r="8"/><circle cx="14" cy="34" r="8"/><circle cx="10" cy="19" r="8"/></g><circle cx="23" cy="23" r="6" fill="#f5c242"/></svg>',
  summer:
    '<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="10" fill="#f5c242"/><g stroke="#f5c242" stroke-width="4" stroke-linecap="round"><path d="M23 4v6M23 36v6M4 23h6M36 23h6M10 10l4 4M32 32l4 4M36 10l-4 4M14 32l-4 4"/></g></svg>',
  autumn:
    '<svg viewBox="0 0 46 46"><path d="M23 4l4 8 9-3-3 9 9 5-9 5 3 9-9-3-4 8-4-8-9 3 3-9-9-5 9-5-3-9 9 3z" fill="#e8896f"/><circle cx="23" cy="23" r="5" fill="#f0a858"/></svg>',
  winter:
    '<svg viewBox="0 0 46 46"><g stroke="#7fb6d8" stroke-width="4" stroke-linecap="round"><path d="M23 5v36M8 14l30 18M38 14L8 32"/></g></svg>',
};

// 收集页面骨架关键元素引用（main.js 启动时调用一次）
// 输入：doc 文档对象；输出：refs 对象
// 异常：任一关键节点缺失抛中文错误（骨架与脚本版本失配早暴露）
export function collectRefs(doc = document) {
  const byId = (id) => doc.getElementById(id);
  const REQUIRED_IDS = [
    "app",
    "bg-layer",
    "petals",
    "confetti",
    "title-bar",
    "title-deco",
    "ribbon",
    "ribbon-text",
    "coin-stage",
    "coin-scene",
    "coin",
    "cat-xiaohei",
    "cat-xiaobai",
    "hint-pill",
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
    app: byId("app"),
    bgLayer: byId("bg-layer"),
    petals: byId("petals"),
    confetti: byId("confetti"),
    titleBar: byId("title-bar"),
    titleDeco: byId("title-deco"),
    ribbon: byId("ribbon"),
    ribbonText: byId("ribbon-text"),
    coinStage: byId("coin-stage"),
    coinScene: byId("coin-scene"),
    coin,
    faces: {
      yes: coin ? coin.querySelector(".face-yes") : null,
      no: coin ? coin.querySelector(".face-no") : null,
    },
    catXiaohei: byId("cat-xiaohei"),
    catXiaobai: byId("cat-xiaobai"),
    hintPill: byId("hint-pill"),
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

// 渲染季节主题：设置 data-season（CSS 变量换肤）+ 标题季节装饰
// 说明：变量定义在 body 上（不是 #app）——浮窗 #overlay 是 #app 的兄弟节点，
//   只有 body 级变量能同时覆盖主界面与浮窗，否则浮窗背景/按钮全部透明
// 输入：refs、season（spring/summer/autumn/winter）；输出：无
export function renderSeason(refs, season) {
  refs.app.dataset.season = season;
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.season = season;
  }
  refs.titleDeco.innerHTML = SEASON_DECO[season] || SEASON_DECO.spring;
}

// 显示结果丝带（YES/NO）：重置动画类保证可重复播放，并触发猫咪欢呼与彩纸屑
// 输入：refs、face（"yes"|"no"）；输出：无
export function showRibbon(refs, face) {
  refs.ribbonText.textContent = face === "yes" ? "YES" : "NO";
  refs.ribbon.classList.remove("show");
  void refs.ribbon.offsetWidth; // 强制 reflow 重启动画
  refs.ribbon.classList.add("show");
  // 猫咪欢呼：移除→reflow→添加，保证每次落定都触发
  for (const cat of [refs.catXiaohei, refs.catXiaobai]) {
    cat.classList.remove("cheer");
    void cat.offsetWidth;
    cat.classList.add("cheer");
  }
  // 彩纸屑
  refs.confetti.classList.remove("show");
  void refs.confetti.offsetWidth;
  refs.confetti.classList.add("show");
}

// 复位结果态：隐藏丝带/彩纸屑/欢呼，提示胶囊回到待机文案
// 输入：refs；输出：无
export function resetResult(refs) {
  refs.ribbon.classList.remove("show");
  refs.confetti.classList.remove("show");
  refs.catXiaohei.classList.remove("cheer");
  refs.catXiaobai.classList.remove("cheer");
  refs.hintPill.textContent = "左右滑动 · 抛硬币";
}

// 设置提示胶囊文案（结果态："再来一次 · 左右滑动"）
// 输入：refs、text；输出：无
export function renderHint(refs, text) {
  refs.hintPill.textContent = text;
}

// 颜色加深/减淡：hex → rgb 按系数缩放（齿环暗色等派生色用）
// 输入：hex "#rrggbb"、factor 缩放系数（0-1）；输出：派生 hex
function shadeHex(hex, factor) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// 构建硬币侧面圆柱壁（PL002）
// 输入：coinEl、n 分段、radius、thick、doc；输出：seg 数组
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
  edge.style.setProperty("--seg-arc", `${arc}px`);
  coinEl.appendChild(edge);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const seg = doc.createElement("div");
    seg.className = "edge-seg";
    seg.style.width = `${arc}px`;
    seg.style.height = `${thick}px`;
    seg.style.marginLeft = `${-arc / 2}px`;
    seg.style.marginTop = `${-thick / 2}px`;
    seg.style.transform = `rotateY(${(i * 360) / n}deg) translateZ(${radius}px)`;
    edge.appendChild(seg);
    segs.push(seg);
  }
  return segs;
}

// 构建币面固定层（PL004）
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

// 设置币面标记（PL004/PL007）：文字→span；图片路径→img（PL005 浮雕化）
function _setFaceMark(faceEl, text) {
  const mark = _ensureFaceLayers(faceEl);
  mark.textContent = "";
  const isImg = typeof text === "string" && /\.(png|jpe?g|webp)$/i.test(text);
  if (isImg) {
    const img = document.createElement("img");
    img.className = "coin-face-img";
    img.alt = "";
    mark.appendChild(img);
    img.onload = () => {
      if (img.dataset.embossed) return;
      img.dataset.embossed = "1";
      try {
        const url = embossImage(img);
        if (url && img.isConnected) img.src = url;
      } catch (err) {
        // 保留原图
      }
    };
    img.src = text;
  } else {
    const span = document.createElement("span");
    span.className = "face-mark";
    if (typeof text === "string" && text.length <= 1) {
      span.classList.add("single");
    }
    span.textContent = text;
    mark.appendChild(span);
  }
}

// 渲染硬币主题（PL003/PL007）：双面文字标记 + palette + 壁色
// 输入：refs（含 faces.yes/no、coin）、theme；输出：无
export function renderCoinTheme(refs, theme) {
  _setFaceMark(refs.faces.yes, theme.faces.yes);
  _setFaceMark(refs.faces.no, theme.faces.no);
  refs.faces.yes.style.setProperty("--coin-face-yes", theme.color);
  refs.faces.no.style.setProperty("--coin-face-no", theme.color);
  const p = theme.palette;
  refs.coin.style.setProperty("--coin-pal-hi", p.hi);
  refs.coin.style.setProperty("--coin-pal-light", p.light);
  refs.coin.style.setProperty("--coin-pal-base", p.base);
  refs.coin.style.setProperty("--coin-pal-dark", p.dark);
  refs.coin.style.setProperty("--coin-pal-deep", p.deep);
  refs.coin.style.setProperty("--coin-edge", theme.color);
  refs.coin.style.setProperty("--coin-rim-hi", theme.color);
  refs.coin.style.setProperty("--coin-rim-lo", shadeHex(theme.color, 0.62));
}

// 设置硬币指定面为展示面
export function setCoinShowFace(refs, theme, which) {
  _setFaceMark(refs.faces[which], theme.faces.show);
  refs.faces[which].style.setProperty(`--coin-face-${which}`, theme.color);
}

// 设置硬币旋转角
export function setCoinAngle(coinEl, angle) {
  coinEl.style.transform = `rotateY(${angle}deg)`;
}

// 战绩时间格式化（PL008，纯函数）：同年 MM-DD HH:mm，跨年 YYYY-MM-DD HH:mm
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

// 渲染战绩列表（PL009 样式）：时间 + 硬币头像 + YES/NO；空态「暂无战绩」
// 输入：el 列表容器、records（最新在上）、now；输出：无
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
    const avatar = document.createElement("span");
    avatar.className =
      item.face === "yes" ? "coin-avatar yes" : "coin-avatar no";
    avatar.textContent = "运";
    const face = document.createElement("span");
    face.className = "history-face";
    face.textContent = item.face === "yes" ? "YES" : "NO";
    li.append(time, avatar, face);
    el.appendChild(li);
  }
}

// 构建战绩浮窗内容（PL008/PL009）：列表 + 清除按钮（二次确认）
// 输入：records、onClear（返回剩余记录）、confirmMs；输出：内容节点
export function buildHistoryContent(records, onClear, confirmMs = 3000) {
  const box = document.createElement("div");
  box.className = "history-box";
  const list = document.createElement("ul");
  list.className = "history-list";
  renderHistoryList(list, records);
  box.appendChild(list);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "sheet-clear";
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

// 主题卡缩略图（与四季背景原图同源裁切，PL009）：assets/thumbs/thumb-<season>@2x.webp
const THEME_THUMBS = {
  spring: "assets/thumbs/thumb-spring@2x.webp",
  summer: "assets/thumbs/thumb-summer@2x.webp",
  autumn: "assets/thumbs/thumb-autumn@2x.webp",
  winter: "assets/thumbs/thumb-winter@2x.webp",
};

// 主题卡中央季节象征（透明 PNG 图标，PL009）：assets/icons/season-<season>.png
const SEASON_ICONS = {
  spring: "assets/icons/season-spring.png",
  summer: "assets/icons/season-summer.png",
  autumn: "assets/icons/season-autumn.png",
  winter: "assets/icons/season-winter.png",
};

// 构建换主题浮窗内容（PL009）：四卡选择 + 自动跟随开关 + 当前季节
// 输入：current 当前季节、autoMode 是否自动、onSelect(season)、onToggleAuto(bool)；输出：内容节点
export function buildThemeContent(current, autoMode, onSelect, onToggleAuto) {
  const box = document.createElement("div");
  box.className = "theme-box";

  const grid = document.createElement("div");
  grid.className = "theme-grid";
  const seasons = ["spring", "summer", "autumn", "winter"];
  const seasonNames = {
    spring: "春",
    summer: "夏",
    autumn: "秋",
    winter: "冬",
  };
  for (const season of seasons) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "theme-tile" + (season === current ? " active" : "");
    tile.dataset.season = season;

    // 场景缩略图（背景原图裁切，实底不透明）
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = THEME_THUMBS[season];
    img.alt = `${seasonNames[season]}季主题`;
    img.draggable = false;
    thumb.appendChild(img);

    // 中央季节象征（透明 PNG 叠加，设计稿构图）
    const emblem = document.createElement("img");
    emblem.className = "emblem";
    emblem.src = SEASON_ICONS[season];
    emblem.alt = "";
    emblem.draggable = false;

    // 选中勾选徽章
    const check = document.createElement("span");
    check.className = "check";
    check.innerHTML =
      '<svg viewBox="0 0 24 24" stroke-linecap="round"><path d="M4 12l5 5L20 6"/></svg>';

    // 季节标签条
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = seasonNames[season];

    tile.append(thumb, emblem, check, label);
    tile.addEventListener("click", () => onSelect(season));
    grid.appendChild(tile);
  }
  box.appendChild(grid);

  const autoRow = document.createElement("div");
  autoRow.className = "auto-row";
  const autoLabel = document.createElement("span");
  autoLabel.textContent = "跟随季节自动切换";
  // kinetics 16. Switch spring 结构（PL009）：switch 内独立 knob 元素 + 弹簧位移
  const sw = document.createElement("span");
  sw.className = "switch" + (autoMode ? " on" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", String(autoMode));
  const knob = document.createElement("span");
  knob.className = "switch-knob";
  sw.appendChild(knob);
  sw.addEventListener("click", () => {
    const next = !sw.classList.contains("on");
    sw.classList.toggle("on", next);
    sw.setAttribute("aria-checked", String(next));
    onToggleAuto(next);
  });
  autoRow.append(autoLabel, sw);
  box.appendChild(autoRow);

  const currentRow = document.createElement("div");
  currentRow.className = "current-season";
  currentRow.innerHTML = `当前：<b>${seasonNames[current]}季</b>`;
  box.appendChild(currentRow);

  return box;
}

// 更新主题浮窗的选中态（PL009）：切主题只改背景与选中卡，不重建浮窗
// 输入：overlay 浮层容器、season 新季节；输出：无
export function updateThemeSelection(overlay, season) {
  const tiles = overlay.querySelectorAll(".theme-tile");
  for (const tile of tiles) {
    tile.classList.toggle("active", tile.dataset.season === season);
  }
  const current = overlay.querySelector(".current-season b");
  if (current) {
    const names = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
    current.textContent = `${names[season] ?? ""}季`;
  }
}

// 显示浮层卡片（PL009 样式）：粉色标题胶囊 + 内容 + 关闭按钮
// 输入：overlay、title、contentEl；输出：卡片节点
export function showSheet(overlay, title, contentEl) {
  const inner = document.createElement("div");
  inner.className = "overlay-inner";
  const sheet = document.createElement("div");
  sheet.className = "sheet";

  const titleEl = document.createElement("div");
  titleEl.className = "sheet-title";
  titleEl.textContent = title;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "sheet-close";
  close.textContent = "关闭";

  sheet.append(titleEl, contentEl, close);
  inner.appendChild(sheet);
  overlay.innerHTML = "";
  overlay.appendChild(inner);
  overlay.hidden = false;
  close.addEventListener("click", () => hideOverlay(overlay));
  return sheet;
}

// 隐藏浮层
export function hideOverlay(overlay) {
  overlay.hidden = true;
  overlay.innerHTML = "";
}

// 轻提示
// 输入：toast 元素、text；输出：无（1.8s 后自动隐藏）
export function showToast(toast, text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

// ===== js/ui.js 模块说明 =====
// 函数清单：
// - SEASON_DECO / THEME_THUMBS：标题季节装饰与主题缩略图（内联 SVG 占位）
// - collectRefs(doc)：骨架元素引用收集（PL009 新结构），缺失 fail-fast
// - renderSeason(refs, season)：设置 data-season（CSS 换肤）+ 标题装饰
// - showRibbon / resetResult / renderHint：结果丝带（含猫咪欢呼/彩纸屑）/ 复位 / 提示文案
// - buildCoinEdge / _ensureFaceLayers / _setFaceMark / renderCoinTheme /
//   setCoinShowFace / setCoinAngle：硬币渲染（PL002-007 体系保留）
// - formatHistoryTime / renderHistoryList：战绩时间格式化与列表（纯函数/纯渲染）
// - buildHistoryContent：战绩浮窗内容（二次确认清零）
// - buildThemeContent：换主题内容（四季卡 + 自动开关 + 当前季节）
// - showSheet / hideOverlay / showToast：浮层与提示
// 设计理由：渲染层只画快照不改业务状态（main.js 唯一业务容器）；
//   PL009 新增四季主题与结果丝带，沿用贴纸风组件与 reduced-motion 约束
// 异常处理：collectRefs 骨架缺失 fail-fast；其余渲染路径零异常不中断
// 关联配置：rules.js SEASONS/SEASON_THEMES/THEMES、coin.js 双面角；消费方 main.js
