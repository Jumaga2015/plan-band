# plan-band

A Claude Code plugin that shows above the prompt what is left of the plan limits (5-hour and weekly), the context use, the prompt cache and the session cost.

```
◕ 5h ▰▰▰▱ 72% →2h14m  ·  ◑ 7d ▰▰▱▱ 48% →3d6h  ·  $0.42  ·  ctx ▰▱▱▱ 23%  ·  cache 95% →52m
```

- Each limit shows the **free** percentage and the time until it resets (`→`). The color goes from green to orange to red as less is left.
- A limit is named after its window, as Claude Code reports it: `5h`, `7d`, or any other window it may report (`1h`, `30d`). A spend limit shows as `Spend`, and an unknown kind as its own name.
- `ctx` shows the **used** percentage of the context window.
- `cache` shows the share of the last response's prompt that the cache served, and the time until the cache expires (`expired` after that). The time is an estimate counted from the last response; see the `cacheTtl` option. It turns orange when less than half the cache lifetime is left (30 minutes with `1h`), and red under a sixth (10 minutes).
- Pointing at the limits shows a tooltip with the local date and time each one resets (`5h today 10:14 AM  ·  7d Tue Oct 20 4:00 PM`). Pointing at `ctx` shows a tooltip with the biggest rows of the context (as `/context` lists them, in % of the window); pointing at `cache`, one with the cache use of the last response (read, written and new tokens). They need a pointer: they do not show where the surface has none.
- The band updates on each measurement of the session and once a minute, so the countdowns move while the session is idle. It does not show until there is data.
- In the classic Windows console (`cmd`), choose a font that has the shapes, such as Cascadia Mono: the classic console does not take missing characters from other fonts, and Consolas does not have `◔ ◑ ◕ ▰ ▱`. Windows Terminal and VS Code show them with any font.

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

## Cache lifetime

The prompt cache lasts 1 hour or 5 minutes after a response, and Claude Code does not report which. The plugin option `cacheTtl` (`1h` by default, or `5m`) sets the one the countdown uses; change it in `/config`.

## Español

Plugin para Claude Code que muestra encima del prompt lo que queda de los límites del plan (5 horas y semanal), el uso del contexto, la caché del prompt y el coste de la sesión.

- Límites: cada uno se nombra por su ventana, como la informa Claude Code: `5h`, `7d` o cualquier otra (`1h`, `30d`). Un límite de gasto sale como `Gasto`, y uno desconocido con su propio nombre.
- Instalación: `/plugin install plan-band --marketplace Jumaga2015/plan-band` en el prompt de Claude Code (terminal).
- Idioma: por defecto, la banda usa el idioma del ajuste `language` de Claude Code. Para elegir otro, cambie la opción `language` del plugin en `/config` (`en`, `es`, `fr`, `de`, `pt` o `it`).
- Caché: `caché 95% →52m` es el porcentaje del prompt de la última respuesta servido por la caché y el tiempo estimado hasta que caduque. La opción `cacheTtl` (`1h` o `5m`) fija la duración que se usa para la cuenta atrás. El tiempo pasa a naranja cuando queda menos de la mitad (30 minutos con `1h`) y a rojo por debajo de una sexta parte (10 minutos).
- Actualización: la banda se actualiza en cada medición de la sesión y una vez por minuto, así que las cuentas atrás avanzan aunque la sesión esté parada.
- Detalle: al pasar el puntero por los límites aparece un tooltip con la fecha y hora locales de cada reinicio (`5h hoy 10:14  ·  7d mar 20 oct 16:00`); por `ctx` aparece un tooltip con las filas mayores del contexto; por `caché`, otro con el uso de la caché de la última respuesta.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
