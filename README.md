# plan-band

A Claude Code plugin that shows above the prompt what is left of the plan limits (5-hour and weekly), the context use, the prompt cache and the session cost.

```
5h ▰▰▰▱→2h14m · 7d ▰▰▱▱→3d6h · $0.42 · ctx ▰▰▰▱→154k · cache ▰▰▰▱→52m
```

- Each limit shows a bar of what is **free** and the time until it resets (`→`). The color goes from green to orange to red as less is left.
- A limit is named after its window, as Claude Code reports it: `5h`, `7d`, or any other window it may report (`1h`, `30d`). A spend limit shows as `Spend`, and an unknown kind as its own name.
- `ctx` shows a bar of what is **free** in the context window and the tokens left (`→154k`). It turns orange when 60% of the window is used, and red at 85%.
- `cache` shows a bar of the lifetime the prompt cache has left, and the time until it expires (`expired` after that). The time is an estimate counted from the last response; see the `cacheTtl` option. Both turn orange when less than half the cache lifetime is left (30 minutes with `1h`), and red under a sixth (10 minutes).
- Clicking a segment swaps its figures for its detail, and a second click brings them back. Each limit shows its free percentage and the local date and time it resets (`5h 72% →today 10:14 AM`, `7d 48% →Tue Oct 20 4:00 PM`), each on its own click; `ctx` shows the used percentage and the biggest rows of the context (as `/context` lists them, in % of the window: `ctx 23%, msgs 9%, sys 8%, tools 5%`); `cache`, the share of the last response's prompt that the cache served and its tokens (`cache 95%, read 90k, written 4k, new 1k tokens`). Without a pointer, `ctrl+x tab` moves the focus to the band, Tab moves it between segments and Enter presses the one under it.
- The band updates on each measurement of the session and once a minute, so the countdowns move while the session is idle. It does not show until there is data.
- In the classic Windows console (`cmd`), choose a font that has the shapes, such as Cascadia Mono: the classic console does not take missing characters from other fonts, and Consolas does not have `▰ ▱`. Windows Terminal and VS Code show them with any font.

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

The band is in English, Spanish, French, German, Portuguese or Italian. By default (`auto`) it follows the `language` setting of Claude Code, written as a code or as the language's name in any of those languages (`"language": "es"`, `"spanish"`, `"español"`, `"Spanisch"`...), and uses English when the setting is not set or not supported. The dates are written as the language writes them.

To choose a language for the band only, set the plugin option `language` to `en`, `es`, `fr`, `de`, `pt` or `it` in `/config`.

## Cache lifetime

The prompt cache lasts 1 hour or 5 minutes after a response, and Claude Code does not report which. The plugin option `cacheTtl` (`1h` by default, or `5m`) sets the one the countdown uses; change it in `/config`.

## Español

Plugin para Claude Code que muestra encima del prompt lo que queda de los límites del plan (5 horas y semanal), el uso del contexto, la caché del prompt y el coste de la sesión.

- Límites: cada uno muestra una barra de lo que queda libre y el tiempo hasta su reinicio (`5h ▰▰▰▱→2h14m`), y se nombra por su ventana, como la informa Claude Code: `5h`, `7d` o cualquier otra (`1h`, `30d`). Un límite de gasto sale como `Gasto`, y uno desconocido con su propio nombre.
- Instalación: `/plugin install plan-band --marketplace Jumaga2015/plan-band` en el prompt de Claude Code (terminal).
- Idioma: por defecto, la banda usa el idioma del ajuste `language` de Claude Code, escrito como código o con el nombre del idioma en cualquiera de los idiomas de la banda (`es`, `spanish`, `español`, `Spanisch`...). Para elegir otro, cambie la opción `language` del plugin en `/config` (`en`, `es`, `fr`, `de`, `pt` o `it`).
- Contexto: `ctx ▰▰▰▱→154k` es una barra de lo que queda libre de la ventana de contexto y los tokens que quedan. Pasa a naranja con el 60% usado y a rojo con el 85%.
- Caché: `caché ▰▰▰▱→52m` es una barra de la vida que le queda a la caché del prompt y el tiempo estimado hasta que caduque. La opción `cacheTtl` (`1h` o `5m`) fija la duración que se usa para la cuenta atrás. Los dos pasan a naranja cuando queda menos de la mitad (30 minutos con `1h`) y a rojo por debajo de una sexta parte (10 minutos).
- Actualización: la banda se actualiza en cada medición de la sesión y una vez por minuto, así que las cuentas atrás avanzan aunque la sesión esté parada.
- Detalle: un clic en un segmento cambia sus cifras por su detalle, y otro clic las devuelve. Cada límite, con su propio clic, muestra su porcentaje libre y la fecha y hora locales de su reinicio (`5h 72% →hoy 10:14`, `7d 48% →mar 20 oct 16:00`); `ctx`, el porcentaje usado y las filas mayores del contexto (`ctx 23%, msgs 9%, sys 8%, tools 5%`); `caché`, el porcentaje del prompt de la última respuesta servido por la caché y sus tokens (`caché 95%, leído 90k, escrito 4k, nuevo 1k tokens`). Sin puntero, `ctrl+x tab` lleva el foco a la banda, Tab lo mueve entre segmentos y Enter pulsa el que lo tiene.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
