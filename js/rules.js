// ============================================================
// 幸运硬币选择 - 规则契约（config/rules.json 的守门人）
// 设计要点：主题在代码内显式声明（P23 契约定案）；滑动/动画/战绩参数必填键
// 导入装配期 fail-fast 中文报错；PL008 删除多局模式后不再有模式/局数契约。
// 关联配置：config/rules.json 是本文件契约的数据镜像。
// ============================================================

// 滑动/动画/战绩/主题参数必填键：缺一即契约失败
export const REQUIRED_KEYS = [
  "idleTimeoutMs",
  "accelFactor",
  "decelDurationMs",
  "swipeThreshold",
  "guideSpeedThreshold",
  "guideMinRemainingDeg",
  "guideSpeedFactor",
  "resultHoldMs",
  "resetFlipMs",
  "historyLimit",
  "clearConfirmMs",
  "themeAutoDefault",
];

// 四季枚举（PL009）：主题切换的单一权威声明
export const SEASONS = Object.freeze({
  SPRING: "spring",
  SUMMER: "summer",
  AUTUMN: "autumn",
  WINTER: "winter",
});

// 每季主题：中文名 / 背景文件 / 装饰标记（配色由 CSS 变量按 data-season 提供）
export const SEASON_THEMES = Object.freeze({
  spring: Object.freeze({
    name: "春",
    bg: "assets/ui/bg-spring@2x.webp",
    deco: "樱",
  }),
  summer: Object.freeze({
    name: "夏",
    bg: "assets/ui/bg-summer@2x.webp",
    deco: "葵",
  }),
  autumn: Object.freeze({
    name: "秋",
    bg: "assets/ui/bg-autumn@2x.webp",
    deco: "枫",
  }),
  winter: Object.freeze({
    name: "冬",
    bg: "assets/ui/bg-winter@2x.webp",
    deco: "雪",
  }),
});

// 月份 → 季节（纯函数）：3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬
// 输入：date Date 对象（默认当前时间）；输出：SEASONS 值
export function seasonOf(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return SEASONS.SPRING;
  if (month >= 6 && month <= 8) return SEASONS.SUMMER;
  if (month >= 9 && month <= 11) return SEASONS.AUTUMN;
  return SEASONS.WINTER;
}

// 主题定义：3 套（gold/silver 文字标记 + anya 图片币面，PL007.3 去 emoji 化）
// faces.show 展示面品牌字「运」（静止时朝上）/ faces.yes「YES」/ faces.no「NO」；
// 文字标记走 .face-mark 浮雕体系（深色冲压字），跨机型渲染一致（不依赖系统 emoji 字体）
// palette 材质光谱（PL003）：hi/light/base/dark/deep 五色，金暖银冷色相拉开；
//   base 与 color 同源（契约兼容），供面片多层渐变/倒角/齿环取色
export const THEMES = Object.freeze({
  gold: Object.freeze({
    name: "金币",
    faces: Object.freeze({ show: "运", yes: "YES", no: "NO" }),
    color: "#f0c75e",
    palette: Object.freeze({
      hi: "#fff6d8",
      light: "#ffe9a0",
      base: "#f0c75e",
      dark: "#c9982f",
      deep: "#8a6d1f",
    }),
  }),
  silver: Object.freeze({
    name: "银币",
    faces: Object.freeze({ show: "运", yes: "YES", no: "NO" }),
    color: "#c9ccd1",
    palette: Object.freeze({
      hi: "#ffffff",
      light: "#e8eaee",
      base: "#c9ccd1",
      dark: "#9aa0ab",
      deep: "#6b7280",
    }),
  }),
  // 图片币面主题（PL004）：faces 为离线包内图片路径（assets/coins/anya/），
  // palette 为中性金棕系（rim/金属层取色，图片自带色彩，实施后目检微调）
  anya: Object.freeze({
    name: "Anya",
    faces: Object.freeze({
      show: "assets/coins/anya/show.jpeg",
      yes: "assets/coins/anya/yes.jpg",
      no: "assets/coins/anya/no.jpeg",
    }),
    color: "#d9b97e",
    palette: Object.freeze({
      hi: "#fff7e0",
      light: "#f4e4c3",
      base: "#d9b97e",
      dark: "#9c7a45",
      deep: "#6b5430",
    }),
  }),
});

// 默认主题
export const DEFAULT_THEME = "gold";

// 弹性数值解析内核：数字直用；数字字符串转数字；其余拒绝（配置侧宽容口径）
function toNumber(value, label) {
  let num = value;
  if (typeof num === "string") {
    num = Number(num.trim());
  }
  if (typeof num !== "number" || !Number.isFinite(num)) {
    throw new Error(`${label}必须是有限数字，收到：${JSON.stringify(value)}`);
  }
  return num;
}

// 校验并规范化规则配置：必填拦截 + 值域口径（PL008：无模式/局数契约）
// 输入：raw 装配层 JSON.parse 后的规则对象
// 输出：规范化对象（滑动/动画/战绩参数 + configVersion）
// 异常：非对象 / 缺必填键 / 数值越界 → 中文 fail-fast
export function validateRules(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`规则配置必须是对象，收到类型：${typeof raw}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in raw) || raw[key] === undefined || raw[key] === null) {
      throw new Error(`规则配置缺少必填键「${key}」，请检查 config/rules.json`);
    }
  }

  const idleTimeoutMs = toNumber(raw.idleTimeoutMs, "idleTimeoutMs ");
  if (idleTimeoutMs <= 0) {
    throw new Error(
      `idleTimeoutMs 必须是正数（滑动允许时间毫秒），收到：${raw.idleTimeoutMs}`,
    );
  }

  const accelFactor = toNumber(raw.accelFactor, "accelFactor ");
  if (accelFactor <= 0) {
    throw new Error(
      `accelFactor 必须是正数（滑动加速系数），收到：${raw.accelFactor}`,
    );
  }

  const decelDurationMs = toNumber(raw.decelDurationMs, "decelDurationMs ");
  if (decelDurationMs <= 0) {
    throw new Error(
      `decelDurationMs 必须是正数（减速时长毫秒），收到：${raw.decelDurationMs}`,
    );
  }

  const swipeThreshold = toNumber(raw.swipeThreshold, "swipeThreshold ");
  if (swipeThreshold <= 0) {
    throw new Error(
      `swipeThreshold 必须是正数（抛硬币手势最小横向位移像素），收到：${raw.swipeThreshold}`,
    );
  }

  const guideSpeedThreshold = toNumber(
    raw.guideSpeedThreshold,
    "guideSpeedThreshold ",
  );
  if (guideSpeedThreshold <= 0) {
    throw new Error(
      `guideSpeedThreshold 必须是正数（落点引导触发速度阈值圈/秒），收到：${raw.guideSpeedThreshold}`,
    );
  }

  const guideMinRemainingDeg = toNumber(
    raw.guideMinRemainingDeg,
    "guideMinRemainingDeg ",
  );
  if (guideMinRemainingDeg <= 0) {
    throw new Error(
      `guideMinRemainingDeg 必须是正数（落点引导最小剩余角，保证旋转观感），收到：${raw.guideMinRemainingDeg}`,
    );
  }

  const guideSpeedFactor = toNumber(raw.guideSpeedFactor, "guideSpeedFactor ");
  if (guideSpeedFactor <= 0) {
    throw new Error(
      `guideSpeedFactor 必须是正数（落点引导速度比例），收到：${raw.guideSpeedFactor}`,
    );
  }

  const resultHoldMs = toNumber(raw.resultHoldMs, "resultHoldMs ");
  if (resultHoldMs <= 0) {
    throw new Error(
      `resultHoldMs 必须是正数（结果面停留毫秒），收到：${raw.resultHoldMs}`,
    );
  }

  const resetFlipMs = toNumber(raw.resetFlipMs, "resetFlipMs ");
  if (resetFlipMs <= 0) {
    throw new Error(
      `resetFlipMs 必须是正数（转回展示面毫秒），收到：${raw.resetFlipMs}`,
    );
  }

  const historyLimit = toNumber(raw.historyLimit, "historyLimit ");
  if (!Number.isInteger(historyLimit) || historyLimit <= 0) {
    throw new Error(
      `historyLimit 必须是正整数（战绩上限条数），收到：${raw.historyLimit}`,
    );
  }

  const clearConfirmMs = toNumber(raw.clearConfirmMs, "clearConfirmMs ");
  if (!Number.isInteger(clearConfirmMs) || clearConfirmMs <= 0) {
    throw new Error(
      `clearConfirmMs 必须是正整数（清零二次确认窗口毫秒），收到：${raw.clearConfirmMs}`,
    );
  }

  // 主题自动跟随季节默认值（PL009，布尔宽容：boolean / "true" / "false" / 0 / 1）
  const autoRaw = raw.themeAutoDefault;
  const themeAutoDefault =
    autoRaw === true || autoRaw === "true" || autoRaw === 1;
  const themeAutoDefaultFalse =
    autoRaw === false || autoRaw === "false" || autoRaw === 0;
  if (!themeAutoDefault && !themeAutoDefaultFalse) {
    throw new Error(
      `themeAutoDefault 必须是布尔值，收到：${JSON.stringify(autoRaw)}`,
    );
  }

  return {
    idleTimeoutMs,
    accelFactor,
    decelDurationMs,
    swipeThreshold,
    guideSpeedThreshold,
    guideMinRemainingDeg,
    guideSpeedFactor,
    resultHoldMs,
    resetFlipMs,
    historyLimit,
    clearConfirmMs,
    themeAutoDefault,
    configVersion:
      raw.configVersion === undefined ? null : String(raw.configVersion),
  };
}

// ===== js/rules.js 模块说明 =====
// 常量与函数清单：
// - REQUIRED_KEYS：rules 结构必填键单一声明处（动画 + 战绩 + 主题参数）
// - SEASONS：四季枚举（spring/summer/autumn/winter）
// - SEASON_THEMES：每季 name/bg（背景文件）/deco（装饰标记），配色由 CSS 变量按 data-season 提供
// - seasonOf(date)：月份→季节纯函数（3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬）
// - THEMES：硬币主题 3 套（gold/silver 文字标记「运/YES/NO」+ anya 图片路径），
//   每套 name/faces{show,yes,no}/color/palette 五色
// - DEFAULT_THEME：默认硬币主题 gold
// - toNumber(value, label)：弹性解析内核（数字直用/字符串 trim 转换/其余拒绝）
// - validateRules(raw)：装配期校验 config/rules.json——必填键/数值口径/主题默认值
// 设计理由：季节枚举与主题参数在代码内显式声明（P23 契约定案，不外置）；
//   PL008 删除多局模式，PL009 增加四季主题（背景/装饰/自动切换默认值）；
//   校验在启动装配期一次完成（运行时零 IO 零重验）
// 异常处理：全部中文 fail-fast 带键名/值定位；规则残缺宁可明确拒绝启动
// 关联配置：config/rules.json；消费方 main.js 装配期调用一次，
//   规范化产物分发 game（seed）、coin 动画（滑动/减速参数）、ui（主题）、history（上限）、theme（模式）
