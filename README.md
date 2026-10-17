# plan-band

A Claude Code plugin that shows above the prompt what is left of the plan limits (5-hour and weekly), the context use and the session cost.

```
◕ 5h ▰▰▰▱ 72% ↻2h14m  ·  ◑ Week ▰▰▱▱ 48% ↻3d6h  ·  ctx ▰▱▱▱ 23%  ·  $0.42
```

- Each limit shows the **free** percentage and the time until it resets (`↻`). The color goes from green to yellow to red as less is left.
- `ctx` shows the **used** percentage of the context window.
- The band updates on each measurement of the session, and does not show until there is data.

## Install

At the prompt of a Claude Code session in a terminal:

```
/plugin install plan-band --marketplace Jumaga2015/plan-band
```

Answer `y` to add the marketplace, then choose the scope (Enter for the user scope).

From a shell:

```
claude plugin install plan-band --marketplace Jumaga2015/plan-band
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Jumaga2015/plan-band`, then **Add plugin**.

## Language

The band is in English, Spanish, French, German, Portuguese or Italian. By default (`auto`) it follows the `language` setting of Claude Code (`"language": "es"`, `"spanish"`, `"español"`...), and uses English when the setting is not set or not supported.

To choose a language for the band only, set the plugin option `language` to `en`, `es`, `fr`, `de`, `pt` or `it` in `/config`.

## Español

Plugin para Claude Code que muestra encima del prompt lo que queda de los límites del plan (5 horas y semanal), el uso del contexto y el coste de la sesión.

- Instalación: `/plugin install plan-band --marketplace Jumaga2015/plan-band` en el prompt de Claude Code (terminal).
- Idioma: por defecto, la banda usa el idioma del ajuste `language` de Claude Code. Para elegir otro, cambie la opción `language` del plugin en `/config` (`en`, `es`, `fr`, `de`, `pt` o `it`).

## License

[MIT](LICENSE)
