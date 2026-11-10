// ============================================================
// 幸运硬币选择 - 主题模式持久化内核（PL009）
// 设计要点：纯函数解析/序列化 + storage 注入包装；宽容解析——坏 JSON /
// 非法 mode / 非法 season 一律回落 null（调用方用默认值兜底），不崩溃。
// 状态结构：{ mode: "auto" | "manual", season: "spring"|"summer"|"autumn"|"winter" }
// 关联配置：config/rules.json themeAutoDefault；消费方 main.js / ui.js。
// ============================================================

// 存储键名（单点声明；版本后缀便于未来结构升级）
export const THEME_KEY = "fortune-choice.theme.v1";

// 合法季节集合（与 rules.js SEASONS 对齐，避免循环依赖就地声明）
const VALID_SEASONS = ["spring", "summer", "autumn", "winter"];

// 宽容解析主题状态：坏 JSON / 非对象 / 非法 mode → null；season 非法置 null
// 输入：json 字符串或 null；输出：{ mode, season } 或 null
export function parseThemeState(json) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const mode = raw.mode === "auto" || raw.mode === "manual" ? raw.mode : null;
  if (!mode) return null;
  const season = VALID_SEASONS.includes(raw.season) ? raw.season : null;
  return { mode, season };
}

// 序列化主题状态
// 输入：{ mode, season }；输出：JSON 字符串
export function serializeThemeState(state) {
  return JSON.stringify(state);
}

// 读取主题状态：storage 缺失/读取异常/坏数据 → null（调用方回落默认）
// 输入：storage（localStorage 或 stub，可为 null）；输出：状态对象或 null
export function loadThemeState(storage) {
  try {
    return parseThemeState(storage ? storage.getItem(THEME_KEY) : null);
  } catch {
    return null;
  }
}

// 保存主题状态：写入异常静默忽略（会话内状态仍可用，不打断交互）
// 输入：storage、{ mode, season }；输出：无
export function saveThemeState(storage, state) {
  try {
    if (storage) storage.setItem(THEME_KEY, serializeThemeState(state));
  } catch {
    // 存储不可用时降级为会话内状态
  }
}

// 清除主题状态（未来"恢复默认"入口用；当前保留导出）
// 输入：storage；输出：无
export function clearThemeState(storage) {
  try {
    if (storage) storage.removeItem(THEME_KEY);
  } catch {
    // 同上
  }
}

// ===== js/theme.js 模块说明 =====
// 常量与函数清单：
// - THEME_KEY：localStorage 单键（fortune-choice.theme.v1）
// - VALID_SEASONS：合法季节白名单（与本文件 parse 校验同源）
// - parseThemeState(json)：宽容解析（坏 JSON/非对象/非法 mode→null；season 非法→null）
// - serializeThemeState(state)：序列化单点
// - loadThemeState / saveThemeState / clearThemeState：storage 注入包装（try/catch 降级）
// 设计理由：与 history.js 同构——纯函数与 IO 分离，内核 node 可测；
//   宽容解析遵循项目错误策略（不崩溃、不阻塞）；状态只含 mode+season 两个字段
// 异常处理：全部 try/catch 静默降级，不抛错不阻塞交互
// 关联配置：config/rules.json themeAutoDefault；消费方 main.js（读写）、ui.js（渲染当前季节）
