// ============================================================
// 幸运硬币选择 - 对局状态机（纯函数，零 DOM 依赖）
// 设计要点：状态枚举 + 不可变快照（状态转移返回新对象不原地突变）；
// 结果先由本模块计算（落定 yes/no 与终局判定），动画只是表现不弄虚作假。
// 关联配置：config/rules.json（模式）；关联模块 random.js（随机源）。
// ============================================================

import { createRNG, deriveSeed } from "./random.js";
import { MODES, validateGameConfig } from "./rules.js";

// 对局状态枚举：动画阶段（ROTATING/SETTLING）由 UI 用 setStatus 临时置，
// toss 落定后自动为 SETTLED 或 FINISHED
export const STATUS = Object.freeze({
  IDLE: "idle",
  ROTATING: "rotating",
  SETTLING: "settling",
  SETTLED: "settled",
  FINISHED: "finished",
});

// 模式 → (局数, 定数) 映射；one-shot 视为 1局1定（单次抛）
// 输入：mode 模式枚举值、customXY 自定义 {x,y}（仅 custom 用）；输出：{x, y}
// 异常：mode 非法 / custom 局数契约不通过 → 中文 fail-fast
function resolveXY(mode, customXY) {
  switch (mode) {
    case MODES.ONESHOT:
      return { x: 1, y: 1 };
    case MODES.THREETWO:
      return { x: 3, y: 2 };
    case MODES.FIVETHREE:
      return { x: 5, y: 3 };
    case MODES.CUSTOM:
      return validateGameConfig(customXY ?? {});
    default:
      throw new Error(
        `对局模式非法，必须是 ${Object.values(MODES).join("/")}，收到：${String(mode)}`,
      );
  }
}

// 统计结果列表中各面计数
// 输入：results（yes/no 数组）；输出：{ yes, no }
function countFaces(results) {
  let yes = 0;
  let no = 0;
  for (const f of results) {
    if (f === "yes") yes += 1;
    else if (f === "no") no += 1;
  }
  return { yes, no };
}

// 收敛判定：任一面向达 Y 个即定局
// 输入：results（yes/no 数组）、{x, y}；输出：{ finished, decision }
export function checkFinished(results, { x, y }) {
  const { yes, no } = countFaces(results);
  if (yes >= y) return { finished: true, decision: "yes" };
  if (no >= y) return { finished: true, decision: "no" };
  return { finished: false, decision: null };
}

// 加赛判定：打满 X 局仍未定（一半一半）需加赛
// 输入：results（yes/no 数组）、{x, y}；输出：boolean
export function needOvertime(results, { x, y }) {
  if (results.length < x) return false;
  return !checkFinished(results, { x, y }).finished;
}

// 创建对局快照：初始 status=IDLE，results 为空
// 输入：config { mode, x, y（custom 需 x/y）}、seed（number|string）
// 输出：不可变对局快照对象
// 异常：mode 非法 / custom 局数契约不通过 / seed 非法 → 中文 fail-fast
export function createGame(config, seed) {
  const mode = config.mode;
  const { x, y } = resolveXY(mode, { x: config.x, y: config.y });
  createRNG(seed);
  return {
    status: STATUS.IDLE,
    results: [],
    currentRound: 0,
    totalRounds: x,
    finished: false,
    decision: null,
    overtime: false,
    mode,
    seed,
    x,
    y,
  };
}

// 抛硬币：按当前局次/加赛 deriveSeed 派生随机流，出 yes/no 并推进对局
// 输入：game 对局快照；输出：新快照（results 追加、status 更新、判定终局/加赛）
// 异常：已终局再 toss → 中文 fail-fast
export function toss(game) {
  if (game.finished) {
    throw new Error("对局已结束，不能再投掷硬币");
  }
  const key = game.overtime ? "overtime" : `r${game.currentRound + 1}`;
  const rng = createRNG(deriveSeed(game.seed, key));
  const face = rng.int(0, 1) === 1 ? "yes" : "no";
  const results = [...game.results, face];

  const fin = checkFinished(results, { x: game.x, y: game.y });
  const overtime =
    !fin.finished && needOvertime(results, { x: game.x, y: game.y });

  return {
    ...game,
    status: fin.finished ? STATUS.FINISHED : STATUS.SETTLED,
    results,
    currentRound: results.length,
    finished: fin.finished,
    decision: fin.decision,
    overtime: game.overtime || overtime,
  };
}

// 状态转移：显式设置动画阶段状态（ROTATING/SETTLING 等），纯函数不突变
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
// - STATUS：对局状态枚举（idle/rotating/settling/settled/finished）
// - resolveXY(mode, customXY)：模式→(x,y) 映射（one-shot=1,1 / three-two=3,2 /
//   five-three=5,3 / custom 走 validateGameConfig）
// - countFaces(results)：统计 yes/no 计数
// - checkFinished(results, {x,y})：收敛判定——任一面达 Y 即定局，返回 {finished, decision}
// - needOvertime(results, {x,y})：加赛判定——打满 X 局仍未定（一半一半）需加赛
// - createGame(config, seed)：初始快照（IDLE、空 results、totalRounds=x）
// - toss(game)：抛硬币——按局次/加赛 deriveSeed 派生随机流，推进结果并判定终局/加赛
// - setStatus(game, status)：显式状态转移（动画阶段用）
// 设计理由：纯函数状态机 + 不可变快照，无头可测、逻辑可解释；结果先计算、
//   动画只是落点表现不弄虚作假（与参考项目同红线）；加赛局 key=overtime 独立派生流
// 异常处理：mode 非法 / custom 局数越界 / 已终局再 toss / setStatus 非法状态
//   → 一律中文 fail-fast，不静默（错误策略主线）
// 关联配置：config/rules.json 的模式与局数；消费方 main.js 装配后驱动 toss/setStatus
