import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { PromptOrigin } from 'claude-code'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

const ROW = {
  plugin: 'right-prompts',
  surface: 'terminal',
  component: 'UserMessage',
  viewport: { columns: 40, rows: 40 },
} as const

const props = (kind: PromptOrigin['kind'], text = 'fix the parser') => ({
  text,
  origin: { kind } as PromptOrigin,
  isExpanded: true,
})

// Whether the row came back wrapped in the mod's right-pushed Box (40 cols: gap 10)
const isRight = async ($: Engine, kind: PromptOrigin['kind']) => {
  const ui = await $.ui.mount({ ...ROW, props: props(kind) })
  const box = await ui.find({ type: 'Box' })
  await ui.unmount()
  return box?.props.justifyContent === 'flex-end' && box.props.paddingLeft === 10
}

// Stands for a bubble plugin beneath: border + paddingX 1 = 4 cells of chrome
const beneath = (on: On) =>
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text color="suggestion">{e.props.text.trim()}</Text>
      </Box>
    )
  })

test('defaults: typed right, follow-ups and notifications left', async ($, on) => {
  beneath(on)
  expect(await isRight($, 'composer')).toBe(true)
  expect(await isRight($, 'auto-continuation')).toBe(false)
  expect(await isRight($, 'task-notification')).toBe(false)
})

test('both toggles flipped', { options: { typed: false, followUps: true } }, async ($, on) => {
  beneath(on)
  expect(await isRight($, 'composer')).toBe(false)
  expect(await isRight($, 'auto-continuation')).toBe(true)
})

test('rows pre-wrapped to the bubble and each flush right', async ($, on) => {
  beneath(on)
  // 40 cols - gap 10 - safety 2 - chrome 4 = 24 cells per row
  const text = 'fix the parser and run the whole suite again\n\nthen ship'
  const ui = await $.ui.mount({ ...ROW, props: props('composer', text) })

  const column = (await ui.findAll({ type: 'Box' })).find(b => b.props.alignItems === 'flex-end')
  expect(column?.props.flexDirection).toBe('column')

  const rows = await ui.findAll({ type: 'Text' })
  expect(rows.map(r => r.text)).toEqual(['fix the parser and run', 'the whole suite again', ' ', 'then ship'])
  expect(rows.every(r => r.props.color === 'suggestion')).toBe(true)
  await ui.unmount()
})

test('a word wider than the row is cut, wide characters counted as 2', async ($, on) => {
  beneath(on)
  const ui = await $.ui.mount({ ...ROW, props: props('composer', 'x'.repeat(30) + ' ' + '漢'.repeat(13)) })
  const rows = (await ui.findAll({ type: 'Text' })).map(r => r.text)
  expect(rows).toEqual(['x'.repeat(24), 'x'.repeat(6), '漢'.repeat(12), '漢'])
  await ui.unmount()
})

// Stands for readable-layout: truncating rules as wide as the viewport around the text
const framed = (on: On) =>
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 80
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="suggestion" wrap="truncate-end">
          {'──'}
          <Text bold>{' You '}</Text>
          {'─'.repeat(columns - 9)}
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          <Text>{e.props.text.trim()}</Text>
        </Box>
        <Text color="suggestion" wrap="truncate-end">
          {'─'.repeat(columns - 2)}
        </Text>
      </Box>
    )
  })

test('a full-width frame stays put; rows hug the widest one', async ($, on) => {
  framed(on)
  // Rules take 38 of 40 cols: no room to shift; 40 - safety 2 - padding 2 = 36 cells per row
  const text = 'fix the parser and run the whole suite again, then ship it'
  const ui = await $.ui.mount({ ...ROW, props: props('composer', text) })

  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.find(b => b.props.justifyContent === 'flex-end')?.props.paddingLeft).toBe(0)
  expect(boxes.find(b => b.props.alignItems === 'flex-end')?.props.alignSelf).toBe('flex-start')

  const rows = (await ui.findAll({ type: 'Text' })).map(r => r.text)
  expect(rows).toContain('fix the parser and run the whole')
  expect(rows).toContain('suite again, then ship it')
  await ui.unmount()
})
