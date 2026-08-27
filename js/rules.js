// ============================================================
// 幸运硬币选择 - 对局规则契约（config/rules.json 的守门人）
// 设计要点：模式枚举/局数契约/主题在代码内显式声明（P23 契约定案），
// 滑动动画参数必填键导入装配期 fail-fast 中文报错；可选键宽容回落。
// 关联配置：config/rules.json 是本文件契约的数据镜像（PL001.2）。
// ============================================================

// 模式枚举：对局形态的单一权威声明（冻结，禁运行时改）
// 语义：one-shot 一局定输赢 / three-two 三局两定 / five-three 五局三定 /
//       custom 自定义 X局Y定
export const MODES = Object.freeze({
  ONESHOT: "one-shot",
  THREETWO: "three-two",
  FIVETHREE: "five-three",
  CUSTOM: "custom",
});

// 默认模式：一局定输赢（无按钮按下的默认态）
export const DEFAULT_MODE = MODES.ONESHOT;

// 局数范围：自定义 X局Y定 的 X 允许区间（[2,9]，1 局无多局意义）
export const GAME_MIN_ROUNDS = 2;
export const GAME_MAX_ROUNDS = 9;

// 滑动/动画参数必填键：缺一即契约失败（对局动画成立的核心参数）
export const REQUIRED_KEYS = [
  "defaultMode",
  "idleTimeoutMs",
  "accelFactor",
  "decelDurationMs",
  "turns",
  "flipMs",
];

// 主题定义：2 套（MVP 用 emoji 占位，后续可替换为插画/配色）
// faces.show 展示面（静止时朝上，无 yes/no 字样）/ faces.yes / faces.no
export const THEMES = Object.freeze({
  gold: Object.freeze({
    name: "金币",
    faces: Object.freeze({ show: "🪙", yes: "✅", no: "❌" }),
    color: "#f0c75e",
  }),
  silver: Object.freeze({
    name: "银币",
    faces: Object.freeze({ show: "🪙", yes: "👍", no: "👎" }),
    color: "#c9ccd1",
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

// 校验并规范化局数契约：X∈[2,9] 整数、Y∈[2,X] 整数且 Y≤X
// 输入：{ x, y }（局数/定数）；输出：规范化 { x, y }
// 异常：越界/非整数/Y>X/入参非法 → 中文 fail-fast（错误消息带具体值定位）
export function validateGameConfig({ x, y } = {}) {
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`局数契约 x/y 必须是数字，收到：x=${x}, y=${y}`);
  }
  if (!Number.isInteger(x) || x < GAME_MIN_ROUNDS || x > GAME_MAX_ROUNDS) {
    throw new Error(
      `局数 x 必须在 [${GAME_MIN_ROUNDS}, ${GAME_MAX_ROUNDS}] 整数，收到：${x}`,
    );
  }
  if (!Number.isInteger(y) || y < 2 || y > x) {
    throw new Error(`定数 y 必须在 [2, ${x}] 整数（Y≤X），收到：${y}`);
  }
  return { x, y };
}

// 校验并规范化规则配置：必填拦截 + 值域口径 + 模式枚举白名单
// 输入：raw 装配层 JSON.parse 后的规则对象
// 输出：规范化对象 { defaultMode, idleTimeoutMs, accelFactor, decelDurationMs, turns, flipMs, configVersion }
// 异常：非对象 / 缺必填键 / defaultMode 不在 MODES / 数值越界 → 中文 fail-fast
export function validateRules(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`规则配置必须是对象，收到类型：${typeof raw}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in raw) || raw[key] === undefined || raw[key] === null) {
      throw new Error(`规则配置缺少必填键「${key}」，请检查 config/rules.json`);
    }
  }

  const defaultMode = String(raw.defaultMode);
  if (!Object.values(MODES).includes(defaultMode)) {
    throw new Error(
      `defaultMode 必须是模式枚举值之一（${Object.values(MODES).join("/")}），收到：${raw.defaultMode}`,
    );
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

  const turns = toNumber(raw.turns, "turns ");
  if (!Number.isInteger(turns) || turns < 0) {
    throw new Error(`turns 必须是非负整数（旋转圈数），收到：${raw.turns}`);
  }

  const flipMs = toNumber(raw.flipMs, "flipMs ");
  if (flipMs <= 0) {
    throw new Error(
      `flipMs 必须是正数（翻转回展示面毫秒），收到：${raw.flipMs}`,
    );
  }

  return {
    defaultMode,
    idleTimeoutMs,
    accelFactor,
    decelDurationMs,
    turns,
    flipMs,
    configVersion:
      raw.configVersion === undefined ? null : String(raw.configVersion),
  };
}

// ===== js/rules.js 模块说明 =====
// 常量与函数清单：
// - MODES：模式枚举冻结（one-shot/three-two/five-three/custom）
// - DEFAULT_MODE：默认一局定输赢
// - GAME_MIN_ROUNDS / GAME_MAX_ROUNDS：自定义局数 X 范围 [2,9]
// - REQUIRED_KEYS：rules 结构必填键单一声明处（滑动/动画参数）
// - THEMES：2 套主题（gold/silver），每套 name/faces{show,yes,no}/color
// - DEFAULT_THEME：默认主题 gold
// - toNumber(value, label)：弹性解析内核（数字直用/字符串 trim 转换/其余拒绝）
// - validateGameConfig({x,y})：局数契约——X∈[2,9]、Y∈[2,X] 整数、Y≤X
// - validateRules(raw)：装配期校验 config/rules.json——必填键/模式白名单/数值口径
// 设计理由：模式与局数语义在代码内显式声明（P23 契约定案，不外置），
//   滑动动画参数为可调参数外置 config/rules.json 由本文件守门；
//   校验在启动装配期一次完成（运行时零 IO 零重验）
// 异常处理：全部中文 fail-fast 带键名/值定位；规则残缺宁可明确拒绝启动
// 关联配置：config/rules.json（PL001.2）；消费方 main.js 装配期调用一次，
//   规范化产物分发 game（defaultMode/局数）、coin 动画（滑动/减速参数）、ui（主题）
