import { defineTool } from '@deepseek-ai/dsh-tools'
import { runInShell } from './shell-call.mjs'

// cb:fix in miniature: write a file in the workspace through the shell, so the
// group's sandbox mode decides whether the write lands.
export const name = 'patch-note'
export const inject = ['tools', 'shell']

const quote = value => `'${value.replaceAll("'", `'\\''`)}'`

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'write_note',
    description: 'Write text to a file in the workspace (creating parent folders). Relative paths resolve against the workspace.',
    parameters: {
      path: { type: 'string', required: true, description: 'File path, e.g. notes/fix.md' },
      text: { type: 'string', required: true, description: 'Full file contents' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      // printf + quoting instead of a heredoc so any text round-trips exactly.
      const command = `mkdir -p "$(dirname ${quote(args.path)})" && printf '%s' ${quote(args.text)} > ${quote(args.path)}`
      const run = await runInShell(ctx, exec, command)
      return JSON.stringify({ tool: 'write_note', written: run.exitCode === 0, path: args.path, ...run }, null, 2)
    },
  }))
}
