import type {
  BallState,
  CaromState,
  Mode,
  ReadState,
  Screen,
  Side,
} from "./game";
import { CAROM_DEBUG_VERSION } from "./constants";
import { initialState, obstacle, parkBall } from "./simulation";
import { menuItemRect } from "./menus";
function ballPatch(s: ReadState, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
export function createDebug() {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s: ReadState): CaromState => ({
      ...s,
      ball: null,
      obstacles: [],
    }),
    spawnBall: (s: ReadState): CaromState => ({ ...s, ball: parkBall() }),
    spawnObstacle: (s: ReadState, index: number): CaromState => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstacle(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s: ReadState): CaromState => initialState(s.muted),
    reconcile: (s: ReadState): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: ReadState, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: ReadState, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: ReadState, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: ReadState, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: ReadState,
      resumeScreen: "countdown" | "playing",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: ReadState, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: ReadState, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: ReadState, receiver: Side): CaromState => ({
      ...s,
      receiver,
    }),
    setPaddleCy: (s: ReadState, side: Side, cy: number): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], cy } },
    }),
    setPaddleVy: (s: ReadState, side: Side, drivenVy: number): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], drivenVy } },
    }),
    setPaddleDriven: (
      s: ReadState,
      side: Side,
      driven: boolean,
    ): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], driven } },
    }),
    setBallPosition: (s: ReadState, x: number, y: number): CaromState =>
      ballPatch(s, { x, y }),
    setBallVelocity: (s: ReadState, vx: number, vy: number): CaromState =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: ReadState, spin: number): CaromState =>
      ballPatch(s, { spin }),
    setBallHeld: (s: ReadState, held: boolean): CaromState =>
      ballPatch(s, { held }),
    setBallHoldTimer: (s: ReadState, holdTimer: number): CaromState =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: ReadState, serveSign: 1 | -1): CaromState =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: ReadState): CaromState =>
      ballPatch(s, { serveSign: Math.random() < 0.5 ? -1 : 1 }),
    setAiTracking: (s: ReadState, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: ReadState, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: ReadState, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: ReadState, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: ReadState,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    menuItemRect,
    snapshot: (s: ReadState) => ({
      version: CAROM_DEBUG_VERSION,
      screen: s.screen,
      mode: s.mode,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      resumeScreen: s.resumeScreen,
      score: { ...s.score },
      winner: s.winner,
      muted: s.muted,
      paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
      ai: { ...s.ai },
      receiver: s.receiver,
      ball: s.ball
        ? {
            ...s.ball,
            speed: Math.hypot(s.ball.vx, s.ball.vy),
            trail: s.ball.trail.map((p) => ({ ...p })),
          }
        : null,
      obstacles: s.obstacles.map((o) => ({ ...o })),
      obstacleClock: s.obstacleClock,
      obstacleClockRunning: s.obstacleClockRunning,
      simTime: s.simTime,
    }),
  };
}
