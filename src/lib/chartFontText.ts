import { existsSync } from 'fs'
import { join } from 'path'
import * as fontkit from 'fontkit'

type FontInstance = fontkit.Font
type TextAnchor = 'start' | 'middle' | 'end'

let chartFont: FontInstance | null = null

function getChartFontPath(): string {
  const candidates: string[] = [
    join(
      process.cwd(),
      'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'
    ),
  ]

  try {
    candidates.unshift(
      join(
        require.resolve('@fontsource/noto-sans-jp/package.json'),
        '../files/noto-sans-jp-japanese-400-normal.woff'
      )
    )
  } catch {
    // @fontsource may not resolve in some bundled contexts; fall back to cwd path.
  }

  const fontPath = candidates.find((candidate) => existsSync(candidate))
  if (!fontPath) {
    throw new Error('Noto Sans JP font file not found for chart rendering')
  }
  return fontPath
}

function loadChartFont(): FontInstance {
  if (chartFont === null) {
    chartFont = fontkit.openSync(getChartFontPath())
  }
  return chartFont
}

function textToPathD(
  font: FontInstance,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: TextAnchor
): string {
  const scale = fontSize / font.unitsPerEm
  const run = font.layout(text)

  let width = 0
  for (let i = 0; i < run.glyphs.length; i++) {
    width += run.positions[i].xAdvance * scale
  }

  let startX = x
  if (anchor === 'end') startX = x - width
  if (anchor === 'middle') startX = x - width / 2

  let d = ''
  let cursorX = startX
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]
    const pos = run.positions[i]
    const glyphX = cursorX + pos.xOffset * scale
    const glyphY = y - pos.yOffset * scale
    d += `${glyph.path.scale(scale).translate(glyphX, glyphY).toSVG()} `
    cursorX += pos.xAdvance * scale
  }

  return d.trim()
}

export function chartTextPath(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  anchor: TextAnchor = 'start'
): string {
  const font = loadChartFont()
  const d = textToPathD(font, text, x, y, fontSize, anchor)
  return `<path d="${d}" fill="${fill}"/>`
}
