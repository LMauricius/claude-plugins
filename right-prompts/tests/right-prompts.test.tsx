import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { PromptOrigin } from 'claude-code'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

const ROW = {
  plugin: 'right-prompts',
  surface: 'terminal',
  component: 'UserMessage',
  viewport: { columns: 100, rows: 40 },
} as const

const props = (kind: PromptOrigin['kind']) => ({
  text: 'fix the parser',
  origin: { kind } as PromptOrigin,
  isExpanded: true,
})

// Whether the row came back wrapped in the mod's right-pushed Box
const isRight = async ($: Engine, kind: PromptOrigin['kind']) => {
  const ui = await $.ui.mount({ ...ROW, props: props(kind) })
  const box = await ui.find({ type: 'Box' })
  await ui.unmount()
  return box?.props.justifyContent === 'flex-end' && box.props.paddingLeft === 25
}

// Stands for what draws beneath (bubble plugin or engine)
const beneath = (on: On) =>
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
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
