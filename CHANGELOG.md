# Changelog

## 0.1.0 (2026-11-19)

First release, based on Herdr Glass 0.1.0 by Noah Chen.

- **Starship background.** The Starship photo is the default picture; Graphite moves to
  the presets copied into `backgrounds/`.
- **Usage meters.** Claude Code pane headers show the model and the 5-hour and 7-day plan
  limits: a bar of what's left, the percent left, and the time to each reset. Fed by
  `extras/claude-statusline.sh`, Claude Code's status line command.
- **Bundled font.** MesloLGM Nerd Font Mono (Regular, Bold) ships in
  `mods/herdr-starship-bg/fonts/`, so the terminals use it without an install.
- Renamed every file and mod to `herdr-starship` so it installs next to Herdr Glass.
