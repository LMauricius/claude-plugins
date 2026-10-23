import type { Register } from 'claude-code'

// Share of the row kept empty on the left: caps the message at 75% width
const LEFT_GAP = 0.25

// Origin kinds per userConfig toggle
const TYPED = ['composer', 'bridge', 'sdk']
const FOLLOW_UPS = ['auto-continuation']

export const register: Register = (on, options) => {
  // Origins to right-align, fixed per load (a config change reloads the module)
  const right = new Set([
    ...(options.typed !== false ? TYPED : []),
    ...(options.followUps === true ? FOLLOW_UPS : []),
  ])

  // Wraps whatever the chain beneath draws (another plugin's bubble, or the
  // engine's row) in a row Box pushed right. Row direction makes the child
  // shrink to its content; paddingLeft is the width cap, so long text wraps
  // inside the right 75% instead of filling the line.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !right.has(e.props.origin.kind)) return next(e)

    const row = await next(e)
    const { Box } = $.ui.resolve(e)
    const gap = Math.floor((e.viewport?.columns ?? 80) * LEFT_GAP)

    return (
      <Box flexDirection="row" justifyContent="flex-end" paddingLeft={gap}>
        {row}
      </Box>
    )
  })
}
