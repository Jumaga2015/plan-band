# plan-band

Plugin para Claude Code que muestra encima del prompt lo que queda de los límites del plan (5 horas y semanal), el uso del contexto y el coste de la sesión.

```
◕ 5h ▰▰▰▱ 72% ↻2h14m  ·  ◑ Semana ▰▰▱▱ 48% ↻3d6h  ·  ctx ▰▱▱▱ 23%  ·  $0.42
```

- Cada límite muestra el porcentaje **libre** y el tiempo hasta que se reinicia (`↻`). El color pasa de verde a amarillo y a rojo cuando queda menos.
- `ctx` muestra el porcentaje **usado** de la ventana de contexto.
- La banda se actualiza en cada medición de la sesión y no se muestra si todavía no hay datos.

## Instalación

En el prompt de una sesión de Claude Code en el terminal:

```
/plugin install plan-band --marketplace Jumaga2015/plan-band
```

Responda `y` para añadir el marketplace y elija el scope (Enter para el scope de usuario).

Desde una shell:

```
claude plugin install plan-band --marketplace Jumaga2015/plan-band
```

En la app de escritorio, donde `/plugin` no funciona: pulse **+** junto al cuadro del prompt, después **Plugins**, **Add marketplace** con `Jumaga2015/plan-band`, y después **Add plugin**.

## Licencia

[MIT](LICENSE)
