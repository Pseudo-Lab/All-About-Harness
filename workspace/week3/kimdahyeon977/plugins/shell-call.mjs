const WIDTH = ['read-only', 'workspace-write', 'danger-full-access']

/**
 * The narrower of the session's resolved mode and the group default. An unknown
 * mode counts as wider than everything, so it falls back to the default.
 */
export function capMode(resolvedMode, defaultMode) {
  const width = WIDTH.indexOf(resolvedMode)
  return width === -1 || width > WIDTH.indexOf(defaultMode) ? defaultMode : resolvedMode
}

/**
 * Run one command through the calling plugin's own `ctx.shell`, resolving the
 * sandbox policy and working directory the same way `dsh-tool-bash` does.
 * Both plugins share this helper so their only difference is which group
 * (and therefore which shell instance) they are mounted in.
 */
export async function runInShell(ctx, exec, command) {
  // Only a confining executor (bash-sandbox) has a mode; bash-local has none.
  const sandboxPolicy = ctx.shell.sandboxMode === undefined ? undefined : ctx.get('sandboxPolicy')
  const resolved = sandboxPolicy?.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
  // The session's logged mode outranks the group default and the session log is
  // shared across groups, so a real agent session (which logs workspace-write at
  // start) would widen the read-only verify group. Run with the narrower of the
  // two: the group default is a ceiling, the session can only narrow it.
  const policy = resolved && { ...resolved, mode: capMode(resolved.mode, sandboxPolicy.defaultMode) }
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
    shell: { executorTimeoutMs: spec.timeoutMs, defaultMode: ctx.shell.sandboxMode ?? 'unconfined', resolvedMode: resolved?.mode ?? null, workdir: spec.workdir },
    sandbox: result.sandbox ?? null,
  }
}
