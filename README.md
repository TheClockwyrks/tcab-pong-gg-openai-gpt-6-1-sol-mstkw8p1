# Carom

A browser-native paddle duel about angles and momentum. Move your paddle at
contact to bend the ball's flight; bank it off two swaying, rotating gold bars.
Play against the computer or a friend on the same keyboard. First to 11 wins,
with a two-point lead.

## Run

Requires a current Node.js installation.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No backend, downloads, or external assets are
needed during play. Graphics and four distinct audio cues are generated in code.

## Production

```sh
npm run build
```

Serve `dist/` from the root of any static web server. `npm run preview` previews
the production build locally.

## Controls

- **Solo:** W/S or Up/Down moves your left paddle.
- **Versus:** W/S moves player one; Up/Down moves player two.
- **Menus:** W/S or Up/Down selects; Enter or Space confirms. Mouse and touch
  also select and confirm menu items.
- **P / Escape:** pause or resume. Escape also returns from the field manual.
- **M:** mute/unmute. The engine provides touch paddle controls on touch devices.
- **Backquote:** engine diagnostic overlay.

## Development

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` run the
repository checks. Tests use the Simple 2D engine with a counted clock and an
in-memory canvas. The render-free simulation, menu transitions, drawing, and
debug poses live in separate modules under `src/`. All persistent simulation
and menu gesture data are immutable values in `CaromState`.

The engine exposes the debug surface as `engine.debug`; poses are applied with
`engine.apply(s => engine.debug.setBallSpin(s, 600))`. It is not installed on
`window`. See `specs/instrumentation.md` for the full surface contract.

Player-facing screenshots and a recorded rally are in `showcase/`.
