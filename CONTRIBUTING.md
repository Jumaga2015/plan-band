# Contributing to plan-band

Thanks for helping. Issues and pull requests are welcome at [Jumaga2015/plan-band](https://github.com/Jumaga2015/plan-band).

## Before you start

- For a bug, open an issue with what the band shows, what you expected, your surface (terminal, desktop app, VS Code) and, in a terminal, which one (Windows Terminal, `cmd`, iTerm...). A screenshot helps.
- For a new feature, open an issue first, so we can agree on it before you write the code. The band is one line above the prompt: anything new has to fit there.

## Layout

| Path | What it holds |
| --- | --- |
| `.claude-plugin/plugin.json` | The plugin manifest: version, description and the `userConfig` options (`language`, `cacheTtl`). |
| `.claude-plugin/marketplace.json` | The marketplace that `/plugin install plan-band --marketplace Jumaga2015/plan-band` reads. |
| `hooks/hooks.json` | Names the hooks module. |
| `hooks/register.tsx` | The hooks module: the measurements it keeps and the band it draws. |
| `types/index.d.ts` | The types of the plugin's state, and its `PluginState` contract. |
| `tests/*.test.tsx` | The tests, run by `claude plugin test`. |

`.claude-plugin/types/` is written by Claude Code when it loads the plugin (the API types and the `tsconfig.json` the repo's own extends). It is not part of the repo.

## Running your copy

Start Claude Code with your checkout as a session-only plugin:

```
claude --plugin-dir <path to your checkout>
```

In the desktop app, where there is no command line, set the environment variable `CLAUDE_CODE_PLUGIN_DIRS` to the path of your checkout and start a new session. The module loads when the session starts: after a change, start a new session (`/clear` does not reload it).

If you also have plan-band installed from the marketplace, uninstall or disable it while you test, so you see your copy.

To see why a hook failed or a tree was refused, run with `claude --debug` and look for lines starting with `plan-band:`.

## Checks

Run both before you open a pull request:

```
claude plugin validate .
claude plugin test .
```

`validate` reads the manifest and the module as Claude Code will, and lists what the module hooks and calls. `test` runs `tests/*.test.tsx` against a mock engine.

To type-check, once Claude Code has loaded the plugin (so `.claude-plugin/types/` exists) and with TypeScript at hand:

```
npx tsc -p .
```

Add or change a test for every behavior you add or change. The tests mock `session.usage`, `clock.now` and `settings.read`, then mount the `AbovePrompt` band and look at the drawn tree; see `tests/detail.test.tsx`.

## Things to keep in mind

- **Surfaces.** The band draws on the terminal and the desktop app. Hover (the `ctx` and cache tooltips) needs a pointer: the band must still read well without it.
- **Windows console.** The classic console (`cmd`) only shows characters its font has. Any new symbol has to be in Cascadia Mono, the font the README recommends for `cmd`; if it is not in Consolas either, check that the README still says so.
- **Width.** Keep segments short. The tooltips come last on the line so nothing is painted over them; keep them there.
- **Colors.** Use the band's colors (`green`, orange `#ff8700`, `red`, `dimColor`) or theme keys, so the band reads the same everywhere.
- **No figures, no band.** The band shows nothing until there is data, and yields to a survey (`hasSurvey`).

## Adding a language

1. Add the code to `Lang` in `types/index.d.ts`.
2. Add its labels to `LABELS` and its limit names to `KINDS` in `hooks/register.tsx` (every key the other languages have). Windows such as `five_hour` need no name: the band writes them as `5h`.
3. Add the names the Claude Code `language` setting may hold for it to `NAMES` (lowercase, without accents).
4. List the code in the description of the `language` option in `.claude-plugin/plugin.json` and in the Language section of the README.
5. Add a case to `tests/language.test.tsx`.

## Versions and commits

- Each change that reaches users bumps `version` in `.claude-plugin/plugin.json`: patch for a fix, minor for a feature.
- Commit messages follow the history: `plan-band <version>: <what changed>` for a release, then a body that says why. The history is in Spanish; English is welcome too.
- Update the README when the band or an option changes, in English and in the Spanish section.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

## Español

Las issues y pull requests son bienvenidas. Antes de una función nueva, abre una issue para acordarla. Para probar tu copia, usa `claude --plugin-dir <ruta>` (o `CLAUDE_CODE_PLUGIN_DIRS` en la app de escritorio, con una sesión nueva tras cada cambio). Antes del pull request, pasa `claude plugin validate .` y `claude plugin test .`, añade tests para lo que cambies, sube la versión en `plugin.json` y actualiza el README en los dos idiomas.
