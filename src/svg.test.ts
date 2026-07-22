import { buildTraceSVG } from './svg'

test('buildTraceSVG embeds image, trace, end marker and escaped attribution', () => {
  const svg = buildTraceSVG(
    400,
    300,
    'data:image/png;base64,AAAA',
    [{ points: [[0, 0], [10, 20]], end: { x: 10, y: 20, label: '12.3km' } }],
    'A & B "co" <x>',
    true,
  )
  expect(svg).toContain('viewBox="0 0 400 300"')
  expect(svg).toContain('<image href="data:image/png;base64,AAAA"')
  expect(svg).toContain('<polyline points="0.0,0.0 10.0,20.0"')
  expect(svg).toContain('>12.3km<')
  // 帰属表示は XML エスケープされる
  expect(svg).toContain('A &amp; B &quot;co&quot; &lt;x&gt;')
})

test('buildTraceSVG omits end marker when showEnd is false', () => {
  const svg = buildTraceSVG(400, 300, 'x', [{ points: [[0, 0], [1, 1]], end: { x: 1, y: 1, label: '1km' } }], 'attr', false)
  expect(svg).not.toContain('<circle')
  expect(svg).not.toContain('>1km<')
})
