// A bar as drawn: the same mark throughout, the filled ones in the tone's color
// and the used ones in the theme's inactive gray. It is written here as the
// band is read: ■ for a filled mark, □ for a used one (`■■■□□`).
export const bar = (color: string, marks: string) => {
  const filled = marks.replace(/□/g, '').length
  const piece = (tone: string, n: number) => (n > 0 ? [`{"type":"Text","props":{"color":"${tone}"},"children":["${'■'.repeat(n)}"]}`] : [])
  return `{"type":"Text","children":[${[...piece(color, filled), ...piece('inactive', marks.length - filled)].join(',')}]}`
}
