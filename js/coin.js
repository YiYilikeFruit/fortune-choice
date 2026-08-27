// ============================================================
// 幸运硬币选择 - 硬币 3D 动画（纯计算内核，零 DOM 依赖）
// 设计要点：速度衰减模型 + 终面朝向计算为纯函数（无头可测）；
// 动画终态对齐 game 计算结果（finalFace 不弄虚作假）；
// DOM 三面构建与事件绑定在 ui.js/装配层，本模块只提供数值内核。
// 关联配置：config/rules.json 的减速时长等动画参数。
// ============================================================

// 三面朝上角（绕 Y 轴，单位度）：展示面 0° / yes 120° / no 240°（三面均布）
export const FACE_ANGLES = Object.freeze({
  show: 0,
  yes: 120,
  no: 240,
});

// 速度衰减：指数衰减 v' = v·e^(-dt/τ)，τ=decelDurationMs
// 低于阈值归 0（模拟硬币停转，避免无限缓慢）
// 输入：dt 时间步（毫秒）、velocity 当前速度、decelDurationMs 减速时长（毫秒）
// 输出：衰减后速度
// 异常：无（纯计算；非法入参按自然衰减兜底，不抛错不中断）
export function tick(dt, velocity, decelDurationMs) {
  if (dt <= 0) return velocity;
  const tau = decelDurationMs > 0 ? decelDurationMs : 1;
  let v = velocity * Math.exp(-dt / tau);
  if (v < 0.05) v = 0;
  return v;
}

// 终面朝向：给定当前累计旋转角，计算使决策面朝上的最小目标总角（≥ 当前角）
// 输入：angle 当前累计旋转角（度）、decision（"yes" | "no"）；输出：目标总角（度）
// 异常：decision 非法 → 中文 fail-fast（不弄虚作假：终面必须对齐决策）
export function finalFace(angle, decision) {
  const target = FACE_ANGLES[decision];
  if (target === undefined) {
    throw new Error(
      `终面 decision 非法，必须为 yes/no，收到：${String(decision)}`,
    );
  }
  const cycles = Math.floor(angle / 360);
  let candidate = cycles * 360 + target;
  if (candidate < angle) candidate += 360;
  return candidate;
}

// 面朝上判定：angle 模 360 对应朝上的面（最近邻）
// 输入：angle 旋转角（度）；输出："show" | "yes" | "no"
// 异常：无（纯计算）
export function faceAtAngle(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (Math.abs(a - FACE_ANGLES.show) < 60 || Math.abs(a - 360) < 60)
    return "show";
  if (Math.abs(a - FACE_ANGLES.yes) < 60) return "yes";
  return "no";
}

// ===== js/coin.js 模块说明 =====
// 常量与函数清单：
// - FACE_ANGLES：三面朝上角（show 0° / yes 120° / no 240°，三面均布）
// - tick(dt, velocity, decelDurationMs)：指数速度衰减内核，阈值归 0
// - finalFace(angle, decision)：由当前累计角与决策面算最小目标总角（终面=决策，不弄虚作假）
// - faceAtAngle(angle)：角度→朝上面（最近邻），供一致性断言与 UI 呈现
// 设计理由：旋转物理（速度衰减）与落点（终面朝向）抽为纯函数，无头可测、
//   与 game 计算结果严格对齐；动效参数（减速时长）走 rules 不硬编码
// 异常处理：finalFace decision 非法 fail-fast；tick/faceAtAngle 纯计算不抛错
// 关联配置：config/rules.json 减速时长；消费方 ui.js/main.js（动画表现层）
