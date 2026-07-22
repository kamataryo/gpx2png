// SVG 組み立ての純粋ロジック（maplibre 等の重い依存を持たないのでそのままテストできる）

export type Trace = { points: [number, number][]; end?: { x: number; y: number; label: string } }

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// PNG のベース地図（imageHref）＋ トレース＋帰属表示から SVG 文字列を組み立てる
export const buildTraceSVG = (
  width: number,
  height: number,
  imageHref: string,
  traces: Trace[],
  attribution: string,
  showEnd: boolean,
): string => {
  const parts: string[] = [
    `<image href="${imageHref}" x="0" y="0" width="${width}" height="${height}"/>`,
  ]
  for (const t of traces) {
    if (t.points.length > 1) {
      const pts = t.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      parts.push(`<polyline points="${pts}" fill="none" stroke="rgb(255,72,0)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`)
    }
    if (showEnd && t.end) {
      const { x, y, label } = t.end
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="rgb(255,72,0)"/>`)
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="darkblue"/>`)
      parts.push(`<text x="${(x - 22).toFixed(1)}" y="${(y - 18).toFixed(1)}" font-family="sans-serif" font-size="32" text-anchor="end" fill="white" stroke="darkblue" stroke-width="3" style="paint-order:stroke">${escapeXml(label)}</text>`)
    }
  }
  parts.push(`<text x="${width - 6}" y="${height - 6}" font-family="sans-serif" font-size="12" text-anchor="end" fill="black" stroke="white" stroke-width="2" style="paint-order:stroke">${escapeXml(attribution)}</text>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}
