import { defineTool } from '@deepseek-ai/dsh-tools'
import { runInShell } from './shell-call.mjs'

// cb:verify in miniature: run a check command, judge PASS/FAIL from its exit code.
export const name = 'check-runner'
export const inject = ['tools', 'shell']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'run_check',
    description: 'Run a verification command (tests, lint, a file check) in the workspace and report PASS when it exits 0, FAIL otherwise. Use it to verify, never to change files.',
    parameters: {
      command: { type: 'string', required: true, description: 'Shell command to run, e.g. `node --test` or `test -f notes/a.md`' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const run = await runInShell(ctx, exec, args.command)
      return JSON.stringify({ tool: 'run_check', verdict: run.exitCode === 0 ? 'PASS' : 'FAIL', ...run }, null, 2)
    },
  }))
}
