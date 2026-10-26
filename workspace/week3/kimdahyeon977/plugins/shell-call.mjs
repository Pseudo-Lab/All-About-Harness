/**
 * Run one command through the calling plugin's own `ctx.shell`, resolving the
 * sandbox policy and working directory the same way `dsh-tool-bash` does.
 * Both plugins share this helper so their only difference is which group
 * (and therefore which shell instance) they are mounted in.
 */
export async function runInShell(ctx, exec, command) {
  // Only a confining executor (bash-sandbox) has a mode; bash-local has none.
  const policy = ctx.shell.sandboxMode === undefined ? undefined
    : ctx.get('sandboxPolicy').resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
  const workdir = policy?.workspaceRoot ?? exec.agent?.session.header.cwd
  const spec = ctx.shell.resolve({
    command,
    signal: exec.signal,
    ...workdir !== undefined ? { workdir } : {},
    ...policy !== undefined ? { sandboxPolicy: policy } : {},
  })
  const result = await ctx.shell.run(spec)
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.text.slice(-2000),
    stderr: result.stderr.text.slice(-2000),
    // Which shell instance answered: timeoutMs differs per group's executor config.
    shell: { executorTimeoutMs: spec.timeoutMs, defaultMode: ctx.shell.sandboxMode ?? 'unconfined', workdir: spec.workdir },
    sandbox: result.sandbox ?? null,
  }
}
