import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { createDebug } from "./debug";
import { initialState, advance } from "./simulation";
import { handleInput } from "./menus";
import { draw } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  /** Pending menu press origins, keyed by runtime pointer id. */
  readonly menuPresses: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}

export type ReadState = DeepReadonly<CaromState>;
export const BACKGROUND = "#0b141b";

export type CaromDebugApi = ReturnType<typeof createDebug>;

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 520,
      freqTo: 240,
      durationMs: 85,
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 230,
      freqTo: 140,
      durationMs: 65,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "square",
      freq: 760,
      freqTo: 340,
      gain: 0.08,
      durationMs: 70,
    });
    api.audio.define(C.CUES.score, {
      wave: "triangle",
      freq: 440,
      freqTo: 880,
      durationMs: 220,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "absent",
    );
    api.diagnostics.register("speed / spin", (s) =>
      s.ball
        ? `${Math.hypot(s.ball.vx, s.ball.vy).toFixed(1)} / ${s.ball.spin.toFixed(1)}`
        : "absent",
    );
    for (const side of ["left", "right"] as const)
      api.diagnostics.register(
        side,
        (s) =>
          `${s.paddles[side].cy.toFixed(1)} / ${s.paddles[side].vy.toFixed(1)}`,
      );
    return [initialState(), createDebug()];
  },
  update(state, api, dt) {
    let next = handleInput(state, api, dt);
    api.audio.setMuted(next.muted);
    next = advance(next, dt, (cue) => api.audio.play(cue));
    return { ...next, muted: api.audio.muted() };
  },
  render: draw,
};
