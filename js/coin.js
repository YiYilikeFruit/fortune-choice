// ============================================================
// 幸运硬币选择 - 硬币 3D 动画（纯计算内核，零 DOM 依赖）
// 设计要点：硬币本体为**双面**（yes 正面 0° / no 背面 180°），
// 绕自身中心轴旋转（transform-origin: center，CSS 侧）；展示面为
// 独立 cover（不参与旋转，旋转开始即消失）。速度衰减与终面朝向
// 为纯函数（无头可测）；动画终态对齐 game 计算结果（finalFace 不弄虚作假）。
// 关联配置：config/rules.json 的减速时长等动画参数。
// ============================================================

// 双面朝上角（绕自身中心轴 Y，单位度）：yes 0° / no 180°；show 为 cover 参考角（不参与旋转）
export const FACE_ANGLES = Object.freeze({
  show: 0,
  yes: 0,
  no: 180,
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
// 异常：decision 非法（含 show，展示面为 cover 不参与落定）→ 中文 fail-fast
export function finalFace(angle, decision) {
  if (decision !== "yes" && decision !== "no") {
    throw new Error(
      `终面 decision 非法，必须为 yes/no，收到：${String(decision)}`,
    );
  }
  const target = FACE_ANGLES[decision];
  const cycles = Math.floor(angle / 360);
  let candidate = cycles * 360 + target;
  if (candidate < angle) candidate += 360;
  return candidate;
}

// 落点引导速度：与剩余角成正比（比例控制）——剩余角大转快、小转慢、归 0 速度归 0，
// 保证旋转停止时角度恰为目标结果面（无 finalFace 校正角度差）
// 输入：remainingDeg 剩余角（度）、speedFactor 速度比例（圈/秒每度）；输出：速度（圈/秒）
// 异常：无（纯计算；remaining 为负即已过冲，归 0 由调用方 snap）
export function guidedVelocity(remainingDeg, speedFactor) {
  return Math.max(0, remainingDeg * speedFactor);
}

// 落点引导单步：速度低至阈值后介入，比例控制推进一帧（不加速：引导速度不超当前速度），
// 剩余角 < 0.5° 时 snap 到目标面（landed=true）。真实 frame 每帧调用本函数。
// 输入：angle 当前累计角、velocity 当前速度（圈/秒）、face 结果面、guiding 是否已锁定引导、
//       guide 配置 { speedThreshold, minRemainingDeg, speedFactor }、dt 时间步（毫秒）
// 输出：{ velocity, angle, guiding, landed, target }（landed=true 时 angle 已精确为目标面）
// 异常：无（纯计算）
export function guidedStep(angle, velocity, face, guiding, guide, dt) {
  if (!guiding && velocity >= guide.speedThreshold) {
    return { velocity, angle, guiding: false, landed: false, target: null };
  }
  const target = finalFace(angle, face);
  let remaining = target - angle;
  // 首次进入引导时保证最少剩余角（不足则多转一圈）；锁定后不再调整，按真实剩余角收敛
  if (!guiding && remaining < guide.minRemainingDeg) remaining += 360;
  const nextV = Math.min(velocity, remaining * guide.speedFactor);
  if (remaining < 0.5) {
    return { velocity: 0, angle: target, guiding: true, landed: true, target };
  }
  return {
    velocity: nextV,
    angle: angle + ((nextV * dt) / 1000) * 360,
    guiding: true,
    landed: false,
    target,
  };
}

// 面朝上判定：angle 模 360 对应朝上的面（双面，最近半圈判定）
// 输入：angle 旋转角（度）；输出："yes" | "no"
// 异常：无（纯计算）
export function faceAtAngle(angle) {
  const a = ((angle % 360) + 360) % 360;
  return Math.round(a / 180) % 2 === 0 ? "yes" : "no";
}

// ===== js/coin.js 模块说明 =====
// 常量与函数清单：
// - FACE_ANGLES：双面朝上角（yes 0° / no 180°；show 为 cover 参考角）
// - tick(dt, velocity, decelDurationMs)：指数速度衰减内核，阈值归 0
// - finalFace(angle, decision)：由当前累计角与决策面算最小目标总角（终面=决策，不弄虚作假）
// - faceAtAngle(angle)：角度→朝上面（最近半圈），供一致性断言与 UI 呈现
// 设计理由：旋转物理（速度衰减）与落点（终面朝向）抽为纯函数，无头可测、
//   与 game 计算结果严格对齐；硬币双面（yes/no）翻转，展示面为独立 cover
//   在旋转开始即消失（用户口径：展示面消失后只剩 yes/no）；动效参数走 rules
// 异常处理：finalFace decision 非法 fail-fast；tick/faceAtAngle 纯计算不抛错
// 关联配置：config/rules.json 减速时长；消费方 ui.js/main.js（动画表现层）
