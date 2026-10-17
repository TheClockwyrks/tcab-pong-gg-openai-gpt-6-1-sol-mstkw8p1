import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, ReadState } from "./game";
import { movePaddles, startMatch, toTitle } from "./simulation";
export function menuItems(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(
  s: ReadState,
  index: number,
): { x: number; y: number; w: number; h: number } | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  const y = s.screen === "howto" ? 596 : s.screen === "title" ? 354 : 366;
  return { x: 430, y: y + index * 66, w: 420, h: 56 };
}
function confirm(s: ReadState): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex, menuPresses: {} };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0 }
      : startMatch({ ...next, mode: s.menuIndex === 0 ? "solo" : "versus" });
  }
  if (s.screen === "howto") return toTitle(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen, menuPresses: {} }
      : s.menuIndex === 1
        ? startMatch(s)
        : toTitle(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? startMatch(s) : toTitle(s);
  return s;
}
export function handleInput(
  state: ReadState,
  api: UpdateApi,
  dt: number,
): CaromState {
  const edge = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  ) as Record<C.ActionName, boolean>;
  const values = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.value(a)]),
  ) as Record<C.ActionName, number>;
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = {
    ...state,
    muted: edge.mute ? !state.muted : state.muted,
  };
  const screen = state.screen;
  if (screen === "playing" || screen === "countdown") {
    if (edge.pause)
      s = {
        ...s,
        resumeScreen: screen,
        screen: "paused",
        menuIndex: 0,
        menuPresses: {},
      };
  } else if (screen === "paused" && (edge.pause || edge.back))
    s = { ...s, screen: s.resumeScreen, menuPresses: {} };
  else if ((screen === "howto" || screen === "matchover") && edge.back)
    s = toTitle(s);
  else if (menuItems(s).length) {
    const count = menuItems(s).length;
    const up = edge["p1-up"] || edge["p2-up"],
      down = edge["p1-down"] || edge["p2-down"];
    let keyboardConfirmed = false;
    if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
    else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
    else if (edge.confirm) {
      s = confirm(s);
      keyboardConfirmed = true;
    }
    if (s.screen === screen) {
      const presses = { ...s.menuPresses };
      let pointerConfirm: number | null = null;
      const hit = (x: number, y: number): number => {
        for (let i = 0; i < count; i++) {
          const r = menuItemRect(s, i);
          if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
            return i;
        }
        return -1;
      };
      for (const p of samples) {
        const index = hit(p.x, p.y);
        if (index >= 0) s = { ...s, menuIndex: index };
        if (p.type === "down" && p.button === "primary") presses[p.id] = index;
        if (p.type === "up") {
          if (index >= 0 && presses[p.id] === index) pointerConfirm = index;
          delete presses[p.id];
        }
      }
      for (const p of contacts) {
        const index = hit(p.x, p.y);
        if (index >= 0) s = { ...s, menuIndex: index };
      }
      s = { ...s, menuPresses: presses };
      if (pointerConfirm !== null && !keyboardConfirmed)
        s = confirm({ ...s, menuIndex: pointerConfirm });
    }
  }
  if (s.screen === "playing" || s.screen === "countdown")
    s = movePaddles(s, values, dt);
  return s;
}
