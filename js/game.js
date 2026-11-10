// ============================================================
// 幸运硬币选择 - 单次投掷内核（纯函数，零 DOM 依赖，PL008 简化）
// 设计要点：不可变快照（状态转移返回新对象）；每次投掷独立出 yes/no，
// 结果先由本模块计算、动画只是落点表现不弄虚作假；seed 可复现单次结果。
// 关联配置：无；关联模块 random.js（随机源）。
// ============================================================

import { createRNG } from "./random.js";

// 对局状态枚举：动画阶段由 UI 用 setStatus 临时置，toss 后为 SETTLED
export const STATUS = Object.freeze({
  IDLE: "idle",
  ROTATING: "rotating",
  SETTLED: "settled",
});

// 创建单次投掷快照：初始 IDLE，lastFace 为空
// 输入：seed（number|string）；输出：不可变快照
// 异常：seed 非法 → createRNG fail-fast（中文，装配期早暴露）
export function createGame(seed) {
  createRNG(seed);
  return {
    status: STATUS.IDLE,
    seed,
    lastFace: null,
  };
}

// 投掷：按 seed 派生随机流出 yes/no，单次即结果
// 输入：game 快照；输出：新快照（lastFace 更新、status=SETTLED）
// 异常：无（seed 已在 createGame 校验）
export function toss(game) {
  const rng = createRNG(game.seed);
  const face = rng.int(0, 1) === 1 ? "yes" : "no";
  return { ...game, lastFace: face, status: STATUS.SETTLED };
}

// 状态转移：显式设置动画阶段状态（ROTATING 等），纯函数不突变
// 输入：game 快照、status 目标状态；输出：新快照
// 异常：status 不在枚举内 → 中文 fail-fast
export function setStatus(game, status) {
  if (!Object.values(STATUS).includes(status)) {
    throw new Error(
      `目标状态非法，必须是 ${Object.values(STATUS).join("/")}，收到：${String(status)}`,
    );
  }
  return { ...game, status };
}

// ===== js/game.js 模块说明 =====
// 常量与函数清单：
// - STATUS：投掷状态枚举（idle/rotating/settled）
// - createGame(seed)：初始快照（IDLE、lastFace 空、seed 校验）
// - toss(game)：单次投掷——createRNG(seed) 出 yes/no，快照置 SETTLED
// - setStatus(game, status)：显式状态转移（动画阶段用）
// 设计理由：PL008 删除多局/加赛后，内核收敛为"一次投掷一个结果"；
//   不可变快照保持状态流转可读；结果先计算、动画只是表现（不弄虚作假）
// 异常处理：seed 非法（createRNG fail-fast）/ setStatus 非法状态 → 中文 fail-fast
// 关联配置：config/rules.json 的动画参数由 main.js 消费；消费方 main.js（toss/setStatus）
