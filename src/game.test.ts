import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game } from "./game";
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  LAYOUT,
  P1_X1,
  SERVE_SPEED,
  SPIN_FROM_PADDLE,
} from "./constants";
const engines: { destroy(): void }[] = [];
afterEach(() => {
  for (const e of engines) e.destroy();
  engines.length = 0;
});
async function setup(ms = 8) {
  const events = new EventTarget();
  const e = createEngine({
    canvas: createCanvas(FIELD_W, FIELD_H) as unknown as HTMLCanvasElement,
    width: FIELD_W,
    height: FIELD_H,
    game,
    layout: LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => FIELD_W,
      cssHeight: () => FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(e);
  await e.initialize();
  const key = (code: string, type = "keydown") => {
    events.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  };
  const tap = async (code: string) => {
    key(code);
    await e.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(type), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
  return { e, d: e.debug, key, tap, pointer };
}
describe("engine-backed screens and input", () => {
  it("initializes every reading and diagnostic", async () => {
    const { e, d } = await setup();
    const s = d.snapshot(e.state);
    expect(s.version).toBe(1);
    expect(s.screen).toBe("title");
    expect(s.ball?.held).toBe(true);
    expect(s.obstacles).toHaveLength(2);
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(8);
    await e.advance(20);
    expect(e.state.obstacleClock).toBe(0);
    expect(e.state.simTime).toBeCloseTo(0.16);
  });
  it("navigates remembered title, howto, versus, pause and restart", async () => {
    const { e, d, tap } = await setup();
    await tap("KeyW");
    expect(e.state.menuIndex).toBe(2);
    await tap("Enter");
    expect(e.state.screen).toBe("howto");
    await tap("Escape");
    expect(e.state.menuIndex).toBe(2);
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    await tap("Escape");
    expect(e.state.screen).toBe("paused");
    const before = e.state.ball;
    await e.advance(5);
    expect(e.state.ball).toEqual(before);
    await tap("Escape");
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(e.state.score.p1).toBe(0);
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(1);
    e.apply((s) => d.setScreen(s, "matchover"));
    await tap("Escape");
    expect(e.state.screen).toBe("title");
  });
  it("gives movement priority and reads mute on every screen", async () => {
    const { e, key, tap } = await setup();
    key("KeyS");
    key("KeyW");
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(2);
    key("KeyS", "keyup");
    key("KeyW", "keyup");
    key("Enter", "keyup");
    await tap("KeyM");
    expect(e.state.muted).toBe(true);
    await tap("Enter");
    expect(e.state.screen).toBe("howto");
    await tap("Enter");
    expect(e.state.screen).toBe("title");
  });
  it("requires matching pointer edges and supports touch and same-frame click", async () => {
    const { e, d, pointer } = await setup();
    const r = d.menuItemRect(e.state, 1)!;
    pointer("pointerdown", r.x + 10, r.y + 10);
    await e.advance(1);
    pointer("pointerup", 0, 0);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", r.x + 10, r.y + 10, 2, "touch");
    pointer("pointerup", r.x + 10, r.y + 10, 2, "touch");
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    expect(d.menuItemRect(e.state, 0)).toBeNull();
  });
  it("serves only after hold, moves countdown paddles and freezes on pause", async () => {
    const { e, d, tap, key } = await setup(10);
    await tap("Enter");
    key("KeyS");
    await e.advance(10);
    expect(e.state.paddles.left.cy).toBeGreaterThan(360);
    key("KeyS", "keyup");
    e.apply((s) => d.setBallServeSign(s, -1));
    e.apply((s) => d.setBallHoldTimer(s, 0));
    await e.advance(1);
    expect(e.state.ball?.x).toBe(640);
    expect(e.state.ball?.vy).toBeLessThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      SERVE_SPEED,
    );
    await tap("KeyP");
    const snapshot = d.snapshot(e.state);
    await e.advance(8);
    expect(d.snapshot(e.state).ball).toEqual(snapshot.ball);
    expect(e.state.obstacleClock).toBe(snapshot.obstacleClock);
  });
});
async function live(ms = 8) {
  const h = await setup(ms);
  const { e, d } = h;
  e.apply((s) => d.clearWorld(s));
  e.apply((s) => d.spawnBall(s));
  e.apply((s) => d.setBallHeld(s, false));
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setAiMovement(s, false));
  return h;
}
describe("physics and real scoring", () => {
  it("adds paddle motion spin and accelerates on contact", async () => {
    const { e, d } = await live();
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 200));
    e.apply((s) => d.setBallPosition(s, P1_X1 + BALL_R + 1, 361.6));
    e.apply((s) => d.setBallVelocity(s, -500, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(520);
    expect(e.state.ball!.spin).toBeGreaterThan(200 * SPIN_FROM_PADDLE - 2);
  });
  it("clamps driven velocity, preserves desired velocity, and resolves wall and caps", async () => {
    const { e, d } = await live();
    e.apply((s) => d.setPaddleCy(s, "left", 665));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 720));
    e.apply((s) => d.setBallPosition(s, 640, 12));
    e.apply((s) => d.setBallVelocity(s, 100, -500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(720);
    e.apply((s) => d.setPaddleCy(s, "left", 360));
    e.apply((s) => d.setPaddleVy(s, "left", 0));
    e.apply((s) => d.setBallPosition(s, 56, 295));
    e.apply((s) => d.setBallVelocity(s, 0, 500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBeLessThan(0);
  });
  it.each([0, Math.PI / 4])(
    "reflects off oriented obstacle at %s",
    async (angle) => {
      const { e, d } = await live(2);
      e.apply((s) => d.spawnObstacle(s, 0));
      e.apply((s) => d.setObstacleClockRunning(s, false));
      e.apply((s) => d.setObstacleClock(s, angle / (Math.PI / 3)));
      const o = e.state.obstacles[0],
        nx = Math.cos(angle),
        ny = Math.sin(angle);
      e.apply((s) => d.setBallPosition(s, o.cx + nx * 22, o.cy + ny * 22));
      e.apply((s) => d.setBallVelocity(s, -nx * 500, -ny * 500));
      await e.advance(3);
      expect(e.state.ball!.vx * nx + e.state.ball!.vy * ny).toBeGreaterThan(0);
      expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(500);
    },
  );
  it("decays spin and curves flight consistently at two step lengths", async () => {
    const run = async (ms: number) => {
      const { e, d } = await live(ms);
      e.apply((s) => d.setBallPosition(s, 600, 360));
      e.apply((s) => d.setBallVelocity(s, 520, 0));
      e.apply((s) => d.setBallSpin(s, 300));
      await e.advance(400 / ms);
      return d.snapshot(e.state).ball!;
    };
    const a = await run(2),
      b = await run(16);
    expect(a.spin).toBeCloseTo(300 * Math.pow(0.5, 0.4 / 0.8));
    expect(a.speed).toBeCloseTo(520);
    expect(Math.abs(a.vx - b.vx)).toBeLessThan(1);
    expect(a.vy).toBeGreaterThan(0);
    expect(a.trail[0].t).toBeGreaterThanOrEqual(0.27);
  });
  it("parks a fresh serve after a point, wins by two and renders matchover", async () => {
    const { e, d, tap } = await live();
    e.apply((s) => d.setScore(s, 10, 10));
    e.apply((s) => d.setBallPosition(s, 1295, 400));
    e.apply((s) => d.setBallVelocity(s, 520, 0));
    await e.advance(1);
    expect(e.state.score.p1).toBe(11);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toHaveLength(0);
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, 1295, 400));
    await e.advance(1);
    expect(e.state.winner).toBe("left");
    expect(e.state.screen).toBe("matchover");
    await tap("Enter");
    expect(e.state.screen).toBe("countdown");
    expect(e.state.score.p1).toBe(0);
  });
  it("scores on the opposite goal and plays one cue per frame", async () => {
    const { e, d } = await live();
    const cues: string[] = [];
    e.events.on("cue:played", (x) => cues.push(x.cue));
    e.apply((s) => d.setScore(s, 0, 10));
    e.apply((s) => d.setBallPosition(s, -20, 300));
    e.apply((s) => d.setBallVelocity(s, -500, 0));
    await e.advance(1);
    expect(e.state.winner).toBe("right");
    expect(cues).toEqual(["score"]);
  });
  it("gates both AI faculties independently and isolates versus controls", async () => {
    const { e, d, key } = await live();
    e.apply((s) => d.setAiMovement(s, true));
    e.apply((s) => d.setBallPosition(s, 1000, 550));
    e.apply((s) => d.setBallVelocity(s, 500, 0));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(560);
    e.apply((s) => d.setAiTracking(s, false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) => d.setAiMovement(s, false));
    e.apply((s) => d.setPaddleCy(s, "right", 100));
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBe(100);
    e.apply((s) => d.setMode(s, "versus"));
    key("ArrowDown");
    await e.advance(1);
    expect(e.state.paddles.right.cy).toBeGreaterThan(100);
    expect(e.state.paddles.left.cy).toBe(360);
  });
});
describe("debug poses", () => {
  it("poses each declared field without advancing, resets and fails loudly", async () => {
    const { e, d } = await setup();
    const original = e.state;
    e.apply((s) => d.setMode(s, "versus"));
    e.apply((s) => d.setMenuIndex(s, 2));
    e.apply((s) => d.setTitleIndex(s, 1));
    e.apply((s) => d.setResumeScreen(s, "countdown"));
    e.apply((s) => d.setWinner(s, "right"));
    e.apply((s) => d.setReceiver(s, "right"));
    e.apply((s) => d.setMuted(s, true));
    e.apply((s) => d.setObstacleClock(s, 1.2));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    e.apply((s) => d.setPaddleVy(s, "right", 99));
    e.apply((s) => d.setBallHoldTimer(s, 0.4));
    e.apply((s) => d.setBallSpin(s, 22));
    e.apply((s) => d.setBallServeSign(s, -1));
    const a = d.snapshot(e.state);
    expect(a.mode).toBe("versus");
    expect(a.muted).toBe(true);
    expect(a.ball!.spin).toBe(22);
    expect(a.obstacles[0].theta).toBeCloseTo((1.2 * Math.PI) / 3);
    expect(a.simTime).toBe(0);
    expect(original.mode).toBe("solo");
    e.apply((s) => d.reconcile(s));
    expect(d.snapshot(e.state)).toEqual(a);
    e.apply((s) => d.drawBallServeSign(s));
    expect([1, -1]).toContain(e.state.ball!.serveSign);
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallPosition(e.state, 0, 0)).toThrow();
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    expect(() => d.setBallSpin(e.state, 1)).toThrow();
    await e.advance(2);
    expect(e.state.ball).toBeNull();
    e.apply((s) => d.spawnBall(s));
    e.apply((s) => d.spawnObstacle(s, 1));
    expect(e.state.obstacles).toHaveLength(1);
    e.apply((s) => d.reset(s));
    expect(e.state.simTime).toBe(0);
    expect(e.state.muted).toBe(true);
    expect(e.state.paddles.right.drivenVy).toBe(0);
    expect(e.state.ai.tracking).toBe(true);
  });
});
