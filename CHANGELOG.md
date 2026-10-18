# Changelog

What each version of plan-band changes for the people who use it. Each version is tagged `plan-band--v<version>`.

## 1.6.1 (2026-10-18)

- **VS Code and the desktop app.** Since 1.5.0 every segment was drawn as a native button, with a blue background and white letters that hid the colors of the bars and the percentages. The figures keep their colors again, and the detail is a card that shows while the pointer is over the segment, in the theme's colors inverted: its text is all in one color, so it reads in a light or a dark theme, and its figures are in bold instead of green, orange or red. The terminal keeps the click, and its detail keeps the band's colors.

## 1.6.0 (2026-10-18)

- `ctx` counts up to auto-compaction: the bar and the `→` figure show what is left before Claude Code compacts the conversation on its own, not before the window is full. With auto-compaction off, they count up to the full window as before. The color follows how much of that way is used (orange at 60%, red at 85%). The detail keeps the share of the *window* in use, as `/context` lists it.
- The band fits the width of the terminal. When it does not fit, the cost goes first; then every segment loses the figure after its arrow (`5h ▰▰▰▱`); then the cache goes, and then `ctx`. The limits and any segment showing its detail always stay.
- Four new options in `/config`, `showLimits`, `showCost`, `showCtx` and `showCache`, hide the sections you do not want. All are on by default.

## 1.5.0 (2026-10-18)

- **Click instead of hover.** The tooltips are gone: they were cards painted over the band, which terminals draw badly. A click on a segment swaps its figures for its detail, and a second click brings them back. Each limit has its own click. Without a pointer, `ctrl+x tab` focuses the band, Tab moves between segments and Enter presses one.
- **A narrower band**, about 66 cells instead of 90: `5h ▰▰▰▱→2h14m · 7d ▰▰▱▱→3d6h · $0.42 · ctx ▰▰▰▱→154k · cache ▰▰▰▱→52m`.
  - Every segment is a name, a bar of what is left and an arrow with a figure. `ctx` shows the tokens left; the cache shows the lifetime it has left.
  - The percentages moved to the detail: the free percentage of a limit, the share of the window in use for `ctx`, and the share of the last prompt the cache served, with its tokens.
  - The separator is ` · `, and the pie glyphs before the limits are gone.
- Dates are written by `Intl` in the band's language, without commas or periods: `Tue Oct 20 4:00 PM`, `mar 20 oct 16:00`. German loses the period after the day (`Di 20 Okt`).
- The `language` setting is recognized by the language's name in any of the band's languages (`Spanisch`, `French (France)`), not only by code or English name.
- The words of each language live in `hooks/lang/`, one file per language. Adding one is now a file and a line.

## 1.4.0 (2026-10-17)

- Pointing at the limits showed the local date and time each one resets. (Replaced by the click in 1.5.0.)

## 1.3.0 (2026-10-17)

- A limit is named after its window as Claude Code reports it (`5h`, `7d`, `1h`, `30d`), with no change to the plugin for a new one. A spend limit shows as `Spend`, and an unknown kind as its own name.

## 1.2.0 (2026-10-17)

- The cache countdown changes color: green while more than half its lifetime is left, orange under half, red under a sixth. It scales with the `cacheTtl` option.

## 1.1.0 (2026-10-17)

- The countdowns advance each minute, with no new measurement of the session.

## 1.0.0 (2026-10-17)

- First stable version, with `homepage`, `repository` and `license` in the manifest.

## 0.3.1 (2026-10-17)

- Orange instead of yellow, and a `CONTRIBUTING.md`.

## 0.3.0 (2026-10-17)

- Tooltips for the context and the cache. (Replaced by the click in 1.5.0.)

## 0.2.2 (2026-10-17)

- `→` instead of `↻` before the time until a limit resets.

## 0.2.1 (2026-10-17)

- The band keeps its language after `/clear`.

## 0.2.0 (2026-10-17)

- The band speaks English, Spanish, French, German, Portuguese and Italian, following the `language` setting of Claude Code or the plugin option.

## 0.1.0 (2026-10-17)

- First version: the plan limits, the context use and the session cost above the prompt.
