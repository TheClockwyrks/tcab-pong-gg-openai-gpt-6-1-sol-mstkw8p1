import type { RenderApi } from "@clockwyrks/simple-2d";
import type { ReadState } from "./game";
import * as C from "./constants";
import { menuItemRect, menuItems } from "./menus";
const INK = "#eee9dc",
  MUTED = "#7e949c",
  TEAL = "#75e2ce",
  ORANGE = "#ff916d",
  GOLD = "#d9c781";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 500,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size > 40 ? '"Arial Black", Arial' : '"Courier New", monospace'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color: string,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function round(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function field(ctx: Context, s: ReadState, dim = false): void {
  ctx.save();
  if (dim) ctx.globalAlpha = 0.16;
  // Sparse surveying grid and court markings keep the ball's path readable.
  for (let x = 120; x < C.FIELD_W; x += 80)
    for (let y = 120; y < C.FIELD_H; y += 80) circle(ctx, x, y, 0.8, "#263942");
  ctx.setLineDash([5, 12]);
  line(ctx, C.NET_X, 92, C.NET_X, C.FIELD_H - 45, "#2d444c");
  ctx.setLineDash([]);
  line(ctx, 28, 2, C.FIELD_W - 28, 2, "#3b525b", 3);
  line(ctx, 28, C.FIELD_H - 2, C.FIELD_W - 28, C.FIELD_H - 2, "#3b525b", 3);
  ctx.strokeStyle = "#243942";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 84, 0, Math.PI * 2);
  ctx.stroke();
  for (const side of ["left", "right"] as const) {
    const p = s.paddles[side],
      x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? TEAL : ORANGE;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    round(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, 8, color);
    ctx.shadowBlur = 0;
    line(ctx, x + 5, p.cy - 20, x + 5, p.cy + 20, "#ffffff66", 2);
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12;
    round(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      7,
      GOLD,
    );
    ctx.shadowBlur = 0;
    for (let y = -48; y < 55; y += 16)
      line(ctx, -4, y, 4, y - 6, "#71663b", 1.5);
    circle(ctx, 0, 0, 3, "#0b141b");
    ctx.restore();
  }
  if (s.ball) {
    const b = s.ball;
    b.trail.forEach((p, i) => {
      const alpha = (i + 1) / b.trail.length;
      ctx.globalAlpha = (dim ? 0.16 : 1) * alpha * 0.4;
      circle(ctx, p.x, p.y, C.BALL_R * (0.3 + alpha * 0.6), INK);
    });
    ctx.globalAlpha = dim ? 0.16 : 1;
    ctx.shadowColor = INK;
    ctx.shadowBlur = 18;
    circle(ctx, b.x, b.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function footer(ctx: Context, s: ReadState): void {
  text(ctx, "CAROM  /  PADDLE STUDIES", 40, 683, 12, MUTED);
  text(
    ctx,
    `${s.muted ? "M  SOUND OFF" : "M  SOUND ON"}     /     P  PAUSE`,
    1240,
    683,
    12,
    MUTED,
    "right",
  );
}
function menu(ctx: Context, s: ReadState): void {
  menuItems(s).forEach((item, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = s.menuIndex === i;
    round(ctx, r.x, r.y, r.w, r.h, 3, selected ? TEAL : "#12232c");
    text(
      ctx,
      `0${i + 1}`,
      r.x + 22,
      r.y + r.h / 2,
      13,
      selected ? "#274e49" : MUTED,
    );
    text(
      ctx,
      item,
      r.x + 68,
      r.y + r.h / 2,
      18,
      selected ? "#0b2425" : INK,
      "left",
      700,
    );
    if (selected) {
      text(ctx, "↗", r.x + r.w - 26, r.y + r.h / 2, 24, "#0b2425", "center");
    }
  });
}
function title(ctx: Context, s: ReadState): void {
  text(ctx, "AN EXERCISE IN ANGLES", C.FIELD_CX, 132, 14, TEAL, "center");
  // Oversized custom lockup: a sliced O contains a bank-shot diagram.
  ctx.save();
  ctx.font = '900 126px "Arial Black", Arial';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText(C.TITLE_TEXT, C.FIELD_CX, 232);
  ctx.restore();
  text(
    ctx,
    "MOVE.  CURVE.  FIND A WAY THROUGH.",
    C.FIELD_CX,
    308,
    14,
    MUTED,
    "center",
  );
  menu(ctx, s);
  text(
    ctx,
    "W / S  OR  ↑ / ↓  TO SELECT     ENTER TO PLAY",
    C.FIELD_CX,
    591,
    12,
    MUTED,
    "center",
  );
  // Graphic bank-shot diagrams flank the centered menu.
  for (const flip of [false, true]) {
    ctx.save();
    ctx.translate(flip ? 1160 : 120, 250);
    if (flip) ctx.scale(-1, 1);
    ctx.globalAlpha = 0.8;
    line(ctx, 0, 270, 128, 150, "#29454b", 2);
    line(ctx, 128, 150, 64, 36, "#29454b", 2);
    ctx.setLineDash([3, 7]);
    line(ctx, 64, 36, 197, -48, TEAL, 2);
    ctx.setLineDash([]);
    round(ctx, 120, 122, 12, 62, 4, GOLD);
    circle(ctx, 64, 36, 7, INK);
    ctx.restore();
  }
  text(ctx, "01 / SPIN", 145, 568, 12, TEAL);
  text(ctx, "02 / BANK", 1136, 568, 12, GOLD, "right");
}
function hud(ctx: Context, s: ReadState): void {
  round(ctx, 460, 18, 360, 88, 6, "#0b141be8");
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    546,
    58,
    48,
    TEAL,
    "center",
    800,
  );
  text(ctx, ":", 640, 54, 27, MUTED, "center");
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    734,
    58,
    48,
    ORANGE,
    "center",
    800,
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} / WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    96,
    10,
    MUTED,
    "center",
  );
  text(ctx, "P1 / W S", 40, 38, 13, TEAL);
  text(
    ctx,
    s.mode === "solo" ? "CPU / AUTOMATIC" : "P2 / ↑ ↓",
    1240,
    38,
    13,
    ORANGE,
    "right",
  );
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN vs MACHINE" : "VERSUS / LOCAL DUEL",
    C.FIELD_CX,
    644,
    12,
    MUTED,
    "center",
  );
}
export function draw(s: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  const isTitle = s.screen === "title" || s.screen === "howto";
  field(ctx, s, isTitle);
  if (s.screen === "title") title(ctx, s);
  else if (s.screen === "howto") {
    text(ctx, "FIELD MANUAL / 01", C.FIELD_CX, 86, 14, TEAL, "center");
    text(ctx, "PLAY THE ANGLES.", C.FIELD_CX, 150, 58, INK, "center", 900);
    const rows = [
      [
        "01",
        "TAKE YOUR SIDE",
        "SOLO: W / S or ↑ / ↓     VERSUS: W / S vs ↑ / ↓",
      ],
      [
        "02",
        "PUT SOME SPIN ON IT",
        "Move at contact to curve the ball. Still paddle, clean shot.",
      ],
      [
        "03",
        "MAKE THE BANK",
        "The gold bars turn and sway. Use them, or find the gap.",
      ],
      [
        "04",
        "GO THE DISTANCE",
        `First to ${C.WIN_SCORE}, lead by ${C.WIN_LEAD}. P / ESC pauses. M toggles sound.`,
      ],
    ];
    rows.forEach(([n, h, b], i) => {
      const y = 238 + i * 83;
      text(ctx, n, 246, y, 15, TEAL);
      text(ctx, h, 304, y, 18, INK, "left", 700);
      text(ctx, b, 304, y + 28, 13, MUTED);
      line(ctx, 246, y + 53, 1030, y + 53, "#20343b");
    });
    menu(ctx, s);
  } else {
    hud(ctx, s);
    if (s.screen === "countdown") {
      text(ctx, "READY", C.FIELD_CX, 292, 24, INK, "center", 700);
      text(
        ctx,
        `${s.receiver === "left" ? "←" : "→"}  SERVING IN ${(s.ball?.holdTimer ?? 0).toFixed(1)}`,
        C.FIELD_CX,
        419,
        12,
        TEAL,
        "center",
      );
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      round(ctx, 0, 0, C.FIELD_W, C.FIELD_H, 0, "#071118d9");
      round(ctx, 390, 165, 500, 430, 10, "#10212a");
      line(ctx, 430, 198, 850, 198, TEAL, 2);
      text(
        ctx,
        s.screen === "paused" ? "TIME OUT" : "MATCH COMPLETE",
        C.FIELD_CX,
        237,
        13,
        TEAL,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : `${s.winner === "left" ? "PLAYER 1" : s.mode === "solo" ? "COMPUTER" : "PLAYER 2"} WINS`,
        C.FIELD_CX,
        294,
        s.screen === "paused" ? 58 : 38,
        INK,
        "center",
        900,
      );
      if (s.screen === "matchover")
        text(
          ctx,
          `${s.score.p1} — ${s.score.p2}`,
          C.FIELD_CX,
          338,
          20,
          MUTED,
          "center",
        );
      menu(ctx, s);
    }
  }
  footer(ctx, s);
  ctx.restore();
}
