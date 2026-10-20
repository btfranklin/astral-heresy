# Astral Heresy

![Astral Heresy banner](https://raw.githubusercontent.com/btfranklin/astral-heresy/main/.github/social%20preview/astral_heresy_social_preview.jpg "Astral Heresy")

Astral Heresy is a browser bullet-hell game. Pilot one interceptor through three
celestial fronts, avoid dense projectile patterns, and defeat the machines of
the choir. Fly close to enemy fire to charge your burst, then use it to clear
space when a route closes.

The game uses native JavaScript modules, WebGL backgrounds, Canvas 2D graphics,
and procedural Web Audio. Local play from source needs no build step or runtime
packages. The public site is built into `dist/`.

[Play Astral Heresy](https://astral-heresy.btfranklin.info/).

## Features

- Three stages: Nebula Gate, Crystalline Choir, and Abyssal Cathedral.
- Three bosses, each with three phases: Seraph of Orbits, Prism Leviathan,
  and Cathedral Maw.
- Pointer or keyboard movement, focused fire, and bursts that clear nearby fire.
- Weapon pickups, hull protection, score chains, and a second loop.
- Procedural music and effects that respond to the stage and combat state.
- Seeded runs and render-study scenes for repeatable development checks.

## Play Locally

Use Python 3 and a desktop browser with WebGL, Canvas 2D, and Web Audio support.
From the repository directory, run:

```bash
./scripts/play.sh
```

The helper starts a local server and opens the game in your browser. Select
**Launch Sortie** or press `Enter` to start. Audio starts with this action.
Press `Ctrl+C` in the terminal to stop the server.

To start the server without opening a browser:

```bash
python3 scripts/serve_local.py 7666 --directory .
```

Then open <http://127.0.0.1:7666/>. Serve the files over HTTP; do not open
`index.html` directly from the file system.

The helper selects a free port on each run to prevent Safari from reusing old
modules. To set a port, use `PORT=8686 ./scripts/play.sh`. The server disables
browser caching.

## Controls

| Action | Input |
| --- | --- |
| Launch | `Enter` or **Launch Sortie** |
| Move | Pointer, `WASD`, or arrow keys |
| Fire | Hold `Z`, `Space`, or the pointer button |
| Focus fire | Hold `Shift` |
| Burst | `X` |
| Restart after a loss | `Enter` or `R` |
| Toggle pointer steering | `M` |

Pass close to enemy projectiles without taking a hit to fill the graze reservoir
and restore burst stocks. Use focused fire when you have a clear lane.

For a fixed gameplay seed, open <http://127.0.0.1:7666/?seed=42>.
Restart uses the same seed. To repeat a run, you must also use the same viewport,
input, and update time steps. See the [runtime guide](./docs/RUNTIME.md).

## Build And Publish

Use Node.js 26.x and npm to prepare the static site:

```bash
npm ci
npm run build
npm run preview
```

Open <http://127.0.0.1:7666/> to inspect the build. Each build replaces `dist/`
with the page, styles, native modules, audio worklet, and MIT license. A static
host can serve this folder without Node.js. Development files and test artifacts
are excluded.

GitHub Actions runs `npm run validate` on pushes and pull requests. After checks
pass on `main`, it uploads only `dist/` and deploys it to GitHub Pages. Other
branches and pull requests do not deploy. See the
[deployment guide](./docs/DEPLOYMENT.md) for setup and recovery.

## Development

Use Node.js 26.x and npm for development checks. Install the locked dependencies:

```bash
npm ci
```

The documentation check also needs the
[Perfect Doc](https://github.com/btfranklin/perfect-doc) executable on `PATH`.
Run the default validation gate:

```bash
npm test
```

This runs the deterministic tests, repository structure and generated-content
checks, and the offline documentation check. After Markdown changes, you can
run the documentation check alone:

```bash
npm run check:docs
```

`perfect-doc.toml` uses GitHub-flavored Markdown and GitHub heading fragments.
It checks local links without route conversion or network access.

For browser checks, install Chromium and run the browser suite:

```bash
npx playwright install chromium
npm run validate
```

This runs the fast gate, builds `dist/`, and tests that build in Chromium.
Browser artifacts are saved under `output/playwright/`. For the separate
rendering-performance measurements, run `npm run test:performance`.
See the [quality guide](./docs/QUALITY.md) for focused test commands and manual
Safari checks.

## Project Structure

- `index.html` and `style.css`: page structure, controls, and overlays.
- `src/`: gameplay, authored content, graphics, audio, and UI modules.
- `tests/`: unit, contract, scenario, browser, and performance tests.
- `scripts/`: local server, content generation, and validation commands.
- `docs/`: architecture, content rules, and verification guides.

Start with the [documentation index](./docs/index.md). The
[architecture guide](./docs/ARCHITECTURE.md) explains the game loop and module
boundaries. The [sound design manifesto](./docs/SOUND_DESIGN.md) explains the
procedural instrument. To add content, use the
[stage and boss guide](./docs/content/stages-bosses.md) and the
[generated content inventory](./docs/generated/content-inventory.md).
Coding agents should start with [AGENTS.md](./AGENTS.md).

## License

Astral Heresy is released under the [MIT License](./LICENSE).
