# Claude Plugins

Small mods for Claude Code (terminal and desktop), written as plugins of function hooks that hot-reload in a session.

| Folder | What it is |
| --- | --- |
| `Pokepal/` | A buddy for your session, with four to pick from: Fuecoco, Mimikyu, Pumpkaboo and Drifloon (`/pokepal` for a random one, `/pokepal <name>` for a specific one; `/pokepal open-panel` shows the side pane with buttons, which stays closed by default; `/pokepal sleep` / `wake` put him to sleep or wake him; `/pokepal off` turns him off for good, `/pokepal on` back on). A side pane plus a mini version above the prompt. Moods follow the session (walks while Claude works, cheers when a turn is done, dozes off when you're away), with voice clips. |
| `Pokeball/` | A Pokéball above the prompt that rocks while Claude works and clicks shut when a turn finishes. |
| `tools/spine-render/` | The scripts used to turn Pokémon Sleep Spine animations into frames (see below): `renderall.html` renders every animation of the listed Pokémon, `process.py` crops and packs them, `mkapng.py` makes the desktop animations. |

## Loading them

In a terminal session:

```bash
claude --plugin-dir "/Users/nick/Dev/Claude Plugins/Pokepal"
```

In the desktop app, load the `plugin-authoring` skill once per session, then link the folders into that session's hot-reload folder:

```bash
ln -s "/Users/nick/Dev/Claude Plugins/Pokepal"  ~/.claude/dev-mods/<session-id>/pokepal
ln -s "/Users/nick/Dev/Claude Plugins/Pokeball" ~/.claude/dev-mods/<session-id>/pokeball
```

The desktop's hot-reload watcher misses edits made through symlinks, so use real copies and keep them in sync after each edit:

```bash
tools/sync-dev.sh [session-id]   # copies Pokepal/ (and Pokeball/ if it is already there) into the newest ~/.claude/dev-mods/<session-id>/
```

Check a mod with `claude plugin validate <folder>`.

## Loading it in every session

Put the folder in `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json` (colon-separated for several folders). Every new session, terminal or desktop app, then loads it:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "/Users/nick/Dev/Claude Plugins/Pokepal" }
```

## Notes on the assets (private repo)

`Pokepal/frames`, `Pokepal/anim` and `Pokepal/sounds` hold art and audio from the Pokémon games. Those belong to Nintendo, Game Freak and The Pokémon Company. They are here for personal use only: keep this repository private and do not redistribute them.

- Animation frames were rendered from the Spine 4.0.63 skeletons for Pokémon Sleep (as shown on the RaenonX Pokémon Sleep Wiki) with `tools/spine-render` and the spine-webgl 4.0 runtime. Render with premultiplied alpha **off**, or the pieces get bright outlines.
- Voice clips are the Scarlet/Violet sounds (Pumpkaboo's from Z-A), from a personal collection.
- Desktop pictures are palette APNGs, because the desktop's SVG source is capped at 131,072 characters.
