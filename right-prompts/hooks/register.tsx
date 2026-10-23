import type { Register, RenderElement, RenderNode } from 'claude-code'

// Share of the row kept empty on the left: caps the message at 75% width
const LEFT_GAP = 0.25

// Cells kept free on the right: a transcript row may sit in a gutter
// slightly narrower than the viewport
const SAFETY = 2

// Origin kinds per userConfig toggle
const TYPED = ['composer', 'bridge', 'sdk']
const FOLLOW_UPS = ['auto-continuation']

// Terminal cells across per spacing step
const STEP: Record<string, number> = { xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }

type Props = Record<string, string | number | boolean>

/** Cells a code point takes in a terminal: 2 for East Asian wide and emoji, else 1. */
const cellsOf = (cp: number): number =>
  (cp >= 0x1100 && cp <= 0x115f) ||
  (cp >= 0x2e80 && cp <= 0xa4cf) ||
  (cp >= 0xac00 && cp <= 0xd7a3) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) ||
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x1f300 && cp <= 0x1faff) ||
  (cp >= 0x20000 && cp <= 0x3fffd)
    ? 2
    : 1

/** Cells a string takes; overcounts zero-width marks, which only wraps a row earlier. */
const cells = (s: string): number => {
  let n = 0
  for (const ch of s) n += cellsOf(ch.codePointAt(0) ?? 0)
  return n
}

/** Splits a word into pieces of at most `width` cells, each at least one character so wrapping always advances. */
const split = (word: string, width: number): string[] => {
  const pieces: string[] = []
  let piece = ''
  let used = 0
  for (const ch of word) {
    const w = cellsOf(ch.codePointAt(0) ?? 0)
    if (piece !== '' && used + w > width) {
      pieces.push(piece)
      piece = ''
      used = 0
    }
    piece += ch
    used += w
  }
  pieces.push(piece)
  return pieces
}

/** Word-wraps text to `width` cells: one entry per drawn row, trailing spaces dropped, a blank row as ' '. */
const wrap = (text: string, width: number): string[] => {
  const rows: string[] = []
  for (const line of text.replace(/\t/g, '    ').split('\n')) {
    let row = ''
    // -1 while the row is empty, so its first word takes no joining space
    let used = -1
    for (const word of line.split(' ')) {
      const w = cells(word)
      if (used + 1 + w <= width) {
        row = used < 0 ? word : `${row} ${word}`
        used += 1 + w
        continue
      }
      if (used >= 0) rows.push(row.trimEnd())
      const pieces = w > width ? split(word, width) : [word]
      // Loop, not push(...pieces): a huge word would overflow the argument stack
      for (let i = 0; i < pieces.length - 1; i++) rows.push(pieces[i] ?? '')
      row = pieces[pieces.length - 1] ?? ''
      used = cells(row)
    }
    rows.push(row.trimEnd() || ' ')
  }
  return rows
}

/** Cells across a Box keeps from its children: border, padding and margin. Sums overlapping props, so it errs wide. */
const chrome = (p: Props = {}): number => {
  const n = (k: string): number => {
    const v = p[k]
    return typeof v === 'number' ? v : typeof v === 'string' ? (STEP[v] ?? 0) : 0
  }
  return (
    (p.borderStyle ? 2 : 0) +
    2 * (n('padding') + n('paddingX') + n('margin') + n('marginX')) +
    n('paddingLeft') + n('paddingRight') + n('marginLeft') + n('marginRight')
  )
}

/**
 * The tree with its first Text that draws exactly `text` swapped for
 * `draw(props, rows)`, the rows wrapped to the cells left at that depth;
 * null when no such Text lies beneath, so the caller keeps the tree as is.
 */
const alignText = (
  node: RenderNode,
  text: string,
  width: number,
  draw: (props: Props, rows: string[]) => RenderElement,
): RenderNode | null => {
  if (typeof node === 'string' || (node.type !== 'Box' && node.type !== 'Text')) return null
  const children = node.children ?? []

  if (node.type === 'Text') {
    // Only a plain-string Text: inline elements would be lost by re-wrapping
    if (!children.every(c => typeof c === 'string')) return null
    const own = children.join('').trim()
    return own === text ? draw(node.props ?? {}, wrap(own, Math.max(1, width))) : null
  }

  const fixed = typeof node.props?.width === 'number' ? node.props.width : Infinity
  const inner = Math.min(width, fixed) - chrome(node.props)
  for (let i = 0; i < children.length; i++) {
    const swapped = alignText(children[i] ?? '', text, inner, draw)
    if (swapped === null) continue
    // Copy, never mutate: the tree beneath may be frozen or reused on repaint
    return { ...node, children: children.map((c, j) => (j === i ? swapped : c)) }
  }
  return null
}

export const register: Register = (on, options) => {
  // Origins to right-align, fixed per load (a config change reloads the module)
  const right = new Set([
    ...(options.typed !== false ? TYPED : []),
    ...(options.followUps === true ? FOLLOW_UPS : []),
  ])

  // Takes whatever the chain beneath draws (another plugin's bubble, or the
  // engine's row), pushes it right, and swaps the Text holding the message for
  // a column of pre-wrapped rows, each flush right. Row direction makes the
  // bubble shrink to its widest row; paddingLeft is the width cap. Without
  // such a Text (the engine's own row) the drawing is only pushed right.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !right.has(e.props.origin.kind)) return next(e)

    const row = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 80
    const gap = Math.floor(columns * LEFT_GAP)

    const draw = (props: Props, rows: string[]) => (
      <Box flexDirection="column" alignItems="flex-end">
        {rows.map(r => (
          <Text {...props}>{r}</Text>
        ))}
      </Box>
    )
    const aligned = alignText(row, e.props.text.trim(), columns - gap - SAFETY, draw) ?? row

    return (
      <Box flexDirection="row" justifyContent="flex-end" paddingLeft={gap}>
        {aligned}
      </Box>
    )
  })
}
