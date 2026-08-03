declare module 'fontkit' {
  export interface FontPosition {
    xAdvance: number
    xOffset: number
    yAdvance: number
    yOffset: number
  }

  export interface FontGlyph {
    path: {
      scale(scale: number): {
        translate(x: number, y: number): { toSVG(): string }
      }
    }
  }

  export interface FontLayout {
    glyphs: FontGlyph[]
    positions: FontPosition[]
  }

  export interface Font {
    unitsPerEm: number
    layout(text: string): FontLayout
  }

  export function openSync(path: string): Font
}
