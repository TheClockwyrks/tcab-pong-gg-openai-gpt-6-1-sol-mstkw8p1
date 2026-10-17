import * as C from "./constants";
import type {
  BallState,
  CaromState,
  ObstacleState,
  PaddleState,
  ReadState,
  Side,
} from "./game";
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export function parkBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: Math.random() < 0.5 ? -1 : 1,
    trail: [],
  };
}
export function obstacle(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new RangeError("Unknown obstacle");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted = false): CaromState {
  const paddle = (): PaddleState => ({
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
    menuPresses: {},
  };
}
export function startMatch(s: ReadState): CaromState {
  const fresh = initialState(s.muted);
  // Debug ownership is changed only by its explicit poses or reset.
  return {
    ...fresh,
    screen: "countdown",
    mode: s.mode,
    titleIndex: s.titleIndex,
    simTime: s.simTime,
    paddles: {
      left: {
        ...fresh.paddles.left,
        driven: s.paddles.left.driven,
        drivenVy: s.paddles.left.drivenVy,
      },
      right: {
        ...fresh.paddles.right,
        driven: s.paddles.right.driven,
        drivenVy: s.paddles.right.drivenVy,
      },
    },
  };
}
export function toTitle(s: ReadState): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
export function movePaddle(
  p: PaddleState,
  vy: number,
  dt: number,
): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
export function movePaddles(
  s: ReadState,
  values: Readonly<Record<C.ActionName, number>>,
  dt: number,
): CaromState {
  const human = (up: boolean, down: boolean) =>
    (Number(down) - Number(up)) * C.PADDLE_SPEED;
  let lv = human(
    !!values["p1-up"] || (s.mode === "solo" && !!values["p2-up"]),
    !!values["p1-down"] || (s.mode === "solo" && !!values["p2-down"]),
  );
  let rv = human(!!values["p2-up"], !!values["p2-down"]);
  if (s.mode === "solo") {
    const defend =
      s.ai.tracking &&
      s.screen === "playing" &&
      s.ball !== null &&
      s.ball.vx > 0;
    const target =
      defend && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - s.paddles.right.cy;
    rv =
      !s.ai.movement ||
      Math.abs(diff) <= (defend ? C.AI_DEADZONE : C.AI_HOME_DEADZONE)
        ? 0
        : Math.sign(diff) *
          Math.min(C.AI_SPEED, dt > 0 ? Math.abs(diff) / dt : C.AI_SPEED);
  }
  if (s.paddles.left.driven) lv = s.paddles.left.drivenVy;
  if (s.paddles.right.driven) rv = s.paddles.right.drivenVy;
  return {
    ...s,
    paddles: {
      left: movePaddle(s.paddles.left, lv, dt),
      right: movePaddle(s.paddles.right, rv, dt),
    },
  };
}
type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
type Emit = (cue: C.CueName) => void;
function paddleCollision(
  b: MovingBall,
  p: PaddleState,
  side: Side,
  emit: Emit,
): void {
  const x0 = side === "left" ? C.P1_X0 : C.P2_X0,
    x1 = side === "left" ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  if (
    b.x <= x0 - C.BALL_R ||
    b.x >= x1 + C.BALL_R ||
    b.y <= y0 - C.BALL_R ||
    b.y >= y1 + C.BALL_R
  )
    return;
  const depths = [
    b.x - x0 + C.BALL_R,
    x1 + C.BALL_R - b.x,
    b.y - y0 + C.BALL_R,
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const angle =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    emit(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      emit(C.CUES.wallBounce);
    }
  }
}
function obstacleCollision(b: MovingBall, o: ObstacleState, emit: Emit): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(lx - qx, ly - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (lx - qx) / dist;
    ny = (ly - qy) / dist;
    push = C.BALL_R - dist;
  } else if (C.OBSTACLE_HW - Math.abs(lx) <= C.OBSTACLE_HH - Math.abs(ly)) {
    nx = lx < 0 ? -1 : 1;
    ny = 0;
    push = C.OBSTACLE_HW - Math.abs(lx) + C.BALL_R;
  } else {
    nx = 0;
    ny = ly < 0 ? -1 : 1;
    push = C.OBSTACLE_HH - Math.abs(ly) + C.BALL_R;
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    emit(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
export function advance(state: ReadState, dt: number, play: Emit): CaromState {
  let s: CaromState = { ...state, simTime: state.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  const cues = new Set<C.CueName>();
  const emit: Emit = (cue) => {
    cues.add(cue);
  };
  const b = s.ball ? { ...s.ball } : null;
  if (b && s.screen === "countdown") {
    b.holdTimer = Math.max(0, b.holdTimer - dt);
    if (b.holdTimer <= 0) {
      b.held = false;
      b.trail = [];
      b.vx =
        (s.receiver === "left" ? -1 : 1) *
        C.SERVE_SPEED *
        Math.cos(C.SERVE_ANGLE);
      b.vy = b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE);
      s = { ...s, screen: "playing" };
    }
  } else if (b && !b.held) {
    const n = Math.max(
        1,
        Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
      ),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const speed = Math.hypot(b.vx, b.vy),
        angle = speed > 0 ? (b.spin / speed) * h : 0,
        c = Math.cos(angle),
        sn = Math.sin(angle),
        vx = b.vx;
      b.vx = vx * c - b.vy * sn;
      b.vy = vx * sn + b.vy * c;
      b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.y - C.BALL_R < 0 && b.vy < 0) {
        b.y = C.BALL_R;
        b.vy = -b.vy;
        emit(C.CUES.wallBounce);
      } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
        b.y = C.FIELD_H - C.BALL_R;
        b.vy = -b.vy;
        emit(C.CUES.wallBounce);
      }
      paddleCollision(b, s.paddles.left, "left", emit);
      paddleCollision(b, s.paddles.right, "right", emit);
      for (const o of s.obstacles) obstacleCollision(b, o, emit);
    }
  }
  if (b)
    b.trail = [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
      (p) => p.t >= s.simTime - C.TRAIL_TIME,
    );
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    ball: b,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  if (b && !b.held && (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)) {
    const scorer = b.x > C.FIELD_W ? "left" : "right";
    const score = {
      p1: s.score.p1 + Number(scorer === "left"),
      p2: s.score.p2 + Number(scorer === "right"),
    };
    const won =
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD);
    s = {
      ...s,
      score,
      ...(won
        ? { screen: "matchover" as const, winner: scorer, menuIndex: 0 }
        : {
            screen: "countdown" as const,
            receiver:
              scorer === "left" ? ("right" as const) : ("left" as const),
            ball: parkBall(),
          }),
    };
    emit(C.CUES.score);
  }
  for (const cue of cues) play(cue);
  return s;
}
