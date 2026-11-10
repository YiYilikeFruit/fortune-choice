// ============================================================
// 幸运硬币选择 - 战绩持久化内核（PL008）
// 设计要点：纯函数内核（append/parse/serialize，node 可测）与 storage 包装
// （load/save/clear，storage 注入便于 stub）分离；宽容解析——坏 JSON / 非数组 /
// 非法条目一律过滤不崩溃；上限截断丢最旧防无界增长；不自动清零。
// 关联配置：config/rules.json 的 historyLimit；消费方 main.js / ui.js。
// ============================================================

// 存储键名（单点声明；版本后缀便于未来结构升级）
export const HISTORY_KEY = "fortune-choice.history.v1";

// 追加战绩：新记录置顶（最新在上），超过上限丢最旧；返回新数组不突变原数组
// 输入：records 旧记录数组、record { at, face }、limit 上限（默认 1000）
// 输出：新记录数组（长度 ≤ limit）
export function appendHistory(records, record, limit = 1000) {
  const next = [record, ...records];
  return next.slice(0, Math.max(1, limit));
}

// 宽容解析：坏 JSON / 非数组 → 空数组；非法条目按字段过滤（不抛错）
// 输入：json 字符串或 null；输出：合法记录数组（保持原顺序，最新在上）
export function parseHistory(json) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r) =>
      r &&
      typeof r.at === "number" &&
      Number.isFinite(r.at) &&
      (r.face === "yes" || r.face === "no"),
  );
}

// 序列化：记录数组 → JSON 字符串
// 输入：records 记录数组；输出：JSON 字符串
export function serializeHistory(records) {
  return JSON.stringify(records);
}

// 读取战绩：storage 缺失/读取异常/坏数据 → 空数组（降级不中断，错误策略主线）
// 输入：storage（localStorage 或 stub，可为 null）；输出：记录数组
export function loadHistory(storage) {
  try {
    return parseHistory(storage ? storage.getItem(HISTORY_KEY) : null);
  } catch {
    return [];
  }
}

// 保存战绩：写入异常静默忽略（会话内记录仍可用，不打断交互）
// 输入：storage、records 记录数组；输出：无
export function saveHistory(storage, records) {
  try {
    if (storage) storage.setItem(HISTORY_KEY, serializeHistory(records));
  } catch {
    // 存储不可用时降级为会话内记录
  }
}

// 清零战绩：移除存储键；异常静默忽略
// 输入：storage（可为 null）；输出：无
export function clearHistory(storage) {
  try {
    if (storage) storage.removeItem(HISTORY_KEY);
  } catch {
    // 同上：存储异常不打断清零流程（内存侧由调用方清空）
  }
}

// ===== js/history.js 模块说明 =====
// 常量与函数清单：
// - HISTORY_KEY：localStorage 单键（fortune-choice.history.v1，结构升级时改后缀）
// - appendHistory(records, record, limit)：置顶追加 + 上限截断，不可变
// - parseHistory(json)：宽容解析（坏 JSON/非数组→[]；非法条目过滤）
// - serializeHistory(records)：序列化单点
// - loadHistory / saveHistory / clearHistory：storage 注入包装（try/catch 降级）
// 设计理由：纯函数与存储 IO 分离——内核 node 可测、存储异常不影响业务；
//   宽容解析遵循项目错误策略（不崩溃、不阻塞、缓存兜底）；
//   置顶存储让渲染与存储顺序一致（最新在上零转换）
// 异常处理：全部 try/catch 静默降级为会话内数据，不抛错不阻塞交互
// 关联配置：config/rules.json historyLimit；消费方 main.js（读写）、ui.js（渲染）
