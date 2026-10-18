/**
 * Verified RALPH bundle: a deployment-owned foreground loop that drives fresh
 * structured-output workers toward one immutable objective and certifies each
 * round with an optional deployment verify command.
 *
 * The bundle registers nothing globally. Its only patch row declares the
 * `verified-ralph` agent preset, and that preset mounts this plugin, so the
 * `verified_ralph` tool exists only for sessions running the preset.
 *
 * @module @local/verified-ralph
 */
import { spawn } from 'node:child_process'
import { appendFile, mkdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

/** Stable plugin name asserted by the Loader row. */
const name = 'verified-ralph'

/** Host services the tool body reads. */
const inject = ['tools', 'subagents']

/** Deployment defaults; a row's config overrides any of them. */
const DEFAULTS = Object.freeze({
  subagentProvider: 'spawn',
  maxRounds: 5,
  verifyCommand: '',
  verifyTimeoutMs: 120000,
  progressFile: '.ralph/progress.md',
  maxFeedbackChars: 4000,
})

/**
 * The one structured report a worker may return. Object-rooted and limited to
 * the raw JSON Schema subset the subagent structured runtime accepts.
 */
const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['continue', 'complete', 'blocked'],
      description:
        'continue while useful in-scope work remains; complete only when the objective is met; blocked only when no meaningful progress is possible without human input or an external state change.',
    },
    summary: {
      type: 'string',
      description: 'A short factual account of what this round did and found.',
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete remaining work in order; empty when status is complete or blocked.',
    },
    blocker: {
      type: 'string',
      description: 'The concrete blocker; empty unless status is blocked.',
    },
  },
  required: ['status', 'summary', 'nextSteps', 'blocker'],
}

/** Canonical tool result: terminal status plus the evidence the loop collected. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['verified', 'blocked', 'self-reported', 'budget-limited', 'round-failed'],
    },
    roundsStarted: { type: 'integer' },
    verifierRounds: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          round: { type: 'integer' },
          exitCode: { type: 'string' },
          passed: { type: 'boolean' },
          timedOut: { type: 'boolean' },
        },
        required: ['round', 'exitCode', 'passed', 'timedOut'],
      },
    },
    lastVerifierOutputTail: { type: 'string' },
    lastWorkerReport: {
      oneOf: [{ type: 'null' }, { type: 'object', additionalProperties: true }],
    },
    progressFile: { type: 'string' },
    failure: { type: 'string' },
    message: { type: 'string' },
  },
  required: [
    'status',
    'roundsStarted',
    'verifierRounds',
    'lastVerifierOutputTail',
    'lastWorkerReport',
    'progressFile',
    'failure',
    'message',
  ],
}

/** Read a positive safe integer from deployment config or throw. */
function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`verified_ralph config \`${field}\` must be a positive safe integer`)
  }
  return value
}

/** Read a normalized string from deployment config or throw. */
function normalizedString(value, field, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') throw new TypeError(`verified_ralph config \`${field}\` must be a string`)
  if (!allowEmpty && value.length === 0) throw new TypeError(`verified_ralph config \`${field}\` must be non-empty`)
  if (value !== value.trim()) throw new TypeError(`verified_ralph config \`${field}\` must be normalized`)
  return value
}

/** Resolve the deployment-owned config, applying defaults outside the Loader too. */
function resolveConfig(config) {
  const source = config !== null && typeof config === 'object' && !Array.isArray(config) ? config : {}
  const verifyCommand = normalizedString(source.verifyCommand ?? DEFAULTS.verifyCommand, 'verifyCommand', {
    allowEmpty: true,
  })
  return {
    subagentProvider: normalizedString(
      source.subagentProvider ?? DEFAULTS.subagentProvider,
      'subagentProvider',
    ),
    maxRounds: positiveInteger(source.maxRounds ?? DEFAULTS.maxRounds, 'maxRounds'),
    verifyCommand,
    verifyTimeoutMs: positiveInteger(source.verifyTimeoutMs ?? DEFAULTS.verifyTimeoutMs, 'verifyTimeoutMs'),
    progressFile: normalizedString(source.progressFile ?? DEFAULTS.progressFile, 'progressFile'),
    maxFeedbackChars: positiveInteger(
      source.maxFeedbackChars ?? DEFAULTS.maxFeedbackChars,
      'maxFeedbackChars',
    ),
  }
}

/** One harmless text content block for a child prompt. */
function textBlock(text) {
  return { type: 'text', text }
}

/** A cancellation error that preserves an Error reason. */
function abortError(signal) {
  const reason = signal.reason
  if (reason instanceof Error) return reason
  const error = new Error('verified_ralph was cancelled')
  error.name = 'AbortError'
  return error
}

/** Throw the caller's cancellation instead of reporting a terminal status. */
function throwIfAborted(signal) {
  if (signal.aborted) throw abortError(signal)
}

/** Normalize a worker report, or return null when it is not valid. */
function readReport(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const status = value.status
  if (status !== 'continue' && status !== 'complete' && status !== 'blocked') return null
  const summary = value.summary
  if (typeof summary !== 'string') return null
  const normalizedSummary = summary.trim()
  if (normalizedSummary.length === 0) return null
  const rawNextSteps = value.nextSteps
  if (!Array.isArray(rawNextSteps) || rawNextSteps.some((step) => typeof step !== 'string')) return null
  const nextSteps = rawNextSteps.map((step) => step.trim()).filter((step) => step.length > 0)
  const rawBlocker = value.blocker
  if (typeof rawBlocker !== 'string') return null
  return { status, summary: normalizedSummary, nextSteps, blocker: rawBlocker.trim() }
}

/** Human-safe one-line text for progress bullets. */
function oneLine(text) {
  return text.replace(/\s+/g, ' ').trim()
}

/** Collapse a thrown value into short diagnostic text. */
function errorText(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * The complete child prompt for one round. It carries only the immutable
 * objective, the round position, the durable-memory instruction, the previous
 * verifier result, and the previous worker report. No parent conversation and
 * no earlier child session is seeded.
 */
function buildRoundPrompt({ objective, round, maxRounds, progressFile, previousReport, previousVerifier, maxFeedbackChars }) {
  const parts = [
    'You are the worker for one round of a Ralph loop toward one immutable objective. You start with no parent conversation and no earlier session. Do not call the verified_ralph tool from this round; you are already its worker.',
    `Immutable objective:\n${objective}`,
    `Round ${round} of ${maxRounds}.`,
    `The shared workspace and the progress file at ${progressFile} are the durable memory. Inspect them first, keep all existing work, and make concrete in-scope progress. Verify what you change.`,
  ]
  if (previousVerifier === null) {
    parts.push('Previous round verifier result: none — this is the first round.')
  } else {
    const timeoutNote = previousVerifier.timedOut ? ' (timed out)' : ''
    parts.push(
      `Previous round verifier result: exit code ${previousVerifier.exitCode}${timeoutNote}.\nLast ${maxFeedbackChars} characters of its output:\n${previousVerifier.tail}`,
    )
  }
  if (previousReport === null) {
    parts.push('Previous worker report: none — this is the first round.')
  } else {
    parts.push(`Previous worker report:\n${JSON.stringify(previousReport, null, 2)}`)
  }
  parts.push(
    'Report the outcome by calling structured_output exactly once: status "continue" while useful in-scope work remains, "complete" only when the objective is met, or "blocked" only when no meaningful progress is possible without human input or an external state change. Keep summary factual, list concrete nextSteps, and leave blocker empty unless blocked.',
  )
  return parts.join('\n\n')
}

/**
 * Start one fresh child through the configured provider and wait for its
 * structured report. A rejection, a non-completed stop, or an invalid report is
 * a failed attempt the caller may retry. The run is always disposed.
 */
async function runChild({ ctx, providerName, parent, prompt, round, attempt, maxRounds, signal }) {
  const run = await ctx.subagents.start(providerName, {
    label: `verified_ralph round ${round}/${maxRounds} attempt ${attempt}`,
    prompt: [textBlock(prompt)],
    parent,
    signal,
    outputSchema: REPORT_SCHEMA,
  })
  try {
    const result = await run.result
    throwIfAborted(signal)
    if (result.stopReason !== 'completed') {
      const diagnostic = typeof result.diagnostic === 'string' ? `: ${result.diagnostic}` : ''
      return { report: null, failure: `child stopped with "${result.stopReason}"${diagnostic}` }
    }
    const report = readReport(result.structured)
    if (report === null) {
      return { report: null, failure: 'child returned no valid structured report' }
    }
    return { report, failure: '' }
  } finally {
    await run.dispose()
  }
}

/** Kill a verifier process tree on timeout or caller cancellation. */
function killTree(child) {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      child.kill('SIGKILL')
    }
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

/**
 * Run the deployment verify command in the caller's working directory with the
 * configured timeout. Resolves with the exit code as text, pass/fail, the
 * timeout flag, and the combined output. Never rejects.
 */
function runVerifier({ command, cwd, timeoutMs, signal }) {
  return new Promise((resolvePromise) => {
    let child
    try {
      child = spawn(command, {
        cwd,
        shell: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })
    } catch (error) {
      resolvePromise({ exitCode: 'spawn-error', passed: false, timedOut: false, output: errorText(error) })
      return
    }

    let output = ''
    let settled = false
    let timedOut = false
    let timer

    const finish = (exitCode) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolvePromise({ exitCode, passed: exitCode === '0', timedOut, output })
    }
    const onData = (chunk) => {
      output += chunk.toString()
    }
    const onAbort = () => {
      killTree(child)
    }

    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', (error) => {
      if (output.length === 0) output = errorText(error)
      finish('spawn-error')
    })
    child.on('close', (code, closeSignal) => {
      if (timedOut) finish('timeout')
      else if (code !== null) finish(String(code))
      else finish(closeSignal === null ? 'no-exit-code' : `signal:${closeSignal}`)
    })

    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)
  })
}

/** Append one round section, creating the progress file and its directory. */
async function appendProgress(file, chunk) {
  await mkdir(dirname(file), { recursive: true })
  let prefix = ''
  try {
    await stat(file)
  } catch {
    prefix = '# Verified RALPH progress log\n\n'
  }
  await appendFile(file, prefix + chunk, 'utf8')
}

/** One durable progress section for a settled round. */
function progressChunk({ round, report, verifier, maxFeedbackChars }) {
  const lines = [
    `## Round ${round}`,
    `- Worker status: ${report.status}`,
    `- Worker summary: ${oneLine(report.summary)}`,
    `- Worker next steps: ${report.nextSteps.length === 0 ? '(none)' : report.nextSteps.map(oneLine).join('; ')}`,
    `- Worker blocker: ${report.blocker.length === 0 ? '(none)' : oneLine(report.blocker)}`,
  ]
  if (verifier === null) {
    lines.push('- Verifier: not run')
  } else {
    lines.push(
      `- Verifier: ${verifier.passed ? 'passed' : 'failed'} (exit code ${verifier.exitCode}${verifier.timedOut ? ', timed out' : ''})`,
    )
    if (verifier.output.length > 0) {
      lines.push('', `Verifier output tail (last up to ${maxFeedbackChars} characters):`, '```')
      lines.push(verifier.output.slice(-maxFeedbackChars).trimEnd(), '```')
    }
  }
  return `${lines.join('\n')}\n\n`
}

/** Human-readable result text shared by the renderer and the stored message. */
function renderMessage(result) {
  const rounds = `${result.roundsStarted} round${result.roundsStarted === 1 ? '' : 's'}`
  const lines = [`verified_ralph ended as ${result.status} after ${rounds}.`]
  if (result.verifierRounds.length === 0) {
    lines.push('Verifier: not configured; no round was machine-checked.')
  } else {
    const checks = result.verifierRounds
      .map((entry) => `round ${entry.round} ${entry.passed ? 'pass' : 'fail'} (exit ${entry.exitCode})`)
      .join(', ')
    lines.push(`Verifier: ${checks}.`)
  }
  if (result.failure.length > 0) lines.push(`Failure: ${result.failure}`)
  lines.push(`Progress file: ${result.progressFile}`)
  if (result.lastWorkerReport !== null) {
    lines.push(`Last worker report:\n${JSON.stringify(result.lastWorkerReport, null, 2)}`)
  } else {
    lines.push('Last worker report: none.')
  }
  if (result.lastVerifierOutputTail.length > 0) {
    lines.push(`Last verifier output tail:\n${result.lastVerifierOutputTail}`)
  }
  return lines.join('\n')
}

/** Resolve the caller's working directory from the live session header. */
function callerCwd(parent) {
  const cwd = parent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : process.cwd()
}

/** Refuse a provider that is missing, inherits context, or lacks structured output. */
function requireFreshProvider(ctx, providerName) {
  const provider = ctx.subagents.getProvider(providerName)
  if (provider === undefined) {
    throw new Error(`verified_ralph subagent provider "${providerName}" is not registered`)
  }
  if (!provider.capabilities.outputSchema) {
    throw new Error(`verified_ralph subagent provider "${providerName}" does not support structured output`)
  }
  if (provider.inheritsParentContext) {
    throw new Error(
      `verified_ralph subagent provider "${providerName}" inherits parent context; a fresh provider is required`,
    )
  }
}

/** Register the deployment-owned verified_ralph tool. */
function apply(ctx, config) {
  const resolved = resolveConfig(config)

  ctx.tools.register({
    name: 'verified_ralph',
    description:
      'Run a foreground verified Ralph loop toward one immutable objective. Each round starts one fresh child through the configured subagent provider; only the objective, the previous verifier result, and the previous worker report cross rounds, and the workspace plus the progress file are the durable memory. The plugin appends every round to the progress file itself. When a verify command is configured it runs after every worker round: exit 0 ends the loop as verified, so a worker "complete" is never trusted on its own. Without one, a worker "complete" ends as self-reported. A worker "blocked" ends as blocked, and the round ceiling ends as budget-limited. Use it when a deployment wants fresh-agent iteration whose completion is machine-checked.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        objective: {
          type: 'string',
          description: 'The immutable completion objective every round works toward.',
        },
        maxRounds: {
          type: 'integer',
          description:
            'Optional positive round cap. Defaults to the deployment cap, which is also the maximum accepted value.',
        },
      },
      required: ['objective'],
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'verified_ralph',
      ...(typeof args?.objective === 'string' ? { rawInput: args.objective } : {}),
    }),
    presentResult: () => ({ card: 'generic' }),
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('verified_ralph requires a calling agent (exec.agent was undefined)')

      const rawObjective = args?.objective
      if (typeof rawObjective !== 'string' || rawObjective.trim().length === 0) {
        throw new Error('verified_ralph objective must be a non-empty string')
      }
      const objective = rawObjective.trim()

      const requestedRounds = args?.maxRounds
      let maxRounds = resolved.maxRounds
      if (requestedRounds !== undefined) {
        if (!Number.isSafeInteger(requestedRounds) || requestedRounds < 1) {
          throw new Error('verified_ralph maxRounds must be a positive safe integer')
        }
        if (requestedRounds > resolved.maxRounds) {
          throw new Error(
            `verified_ralph maxRounds ${requestedRounds} exceeds the deployment ceiling ${resolved.maxRounds}`,
          )
        }
        maxRounds = requestedRounds
      }

      requireFreshProvider(ctx, resolved.subagentProvider)
      throwIfAborted(exec.signal)

      const cwd = callerCwd(parent)
      const progressFile = isAbsolute(resolved.progressFile)
        ? resolved.progressFile
        : resolve(cwd, resolved.progressFile)

      const verifierRounds = []
      let lastVerifierOutputTail = ''
      let lastWorkerReport = null
      let roundsStarted = 0
      let failure = ''
      let status = 'budget-limited'
      let settled = false
      let previousReport = null
      let previousVerifier = null

      for (let round = 1; round <= maxRounds && !settled; round += 1) {
        throwIfAborted(exec.signal)
        roundsStarted = round

        const prompt = buildRoundPrompt({
          objective,
          round,
          maxRounds,
          progressFile,
          previousReport,
          previousVerifier,
          maxFeedbackChars: resolved.maxFeedbackChars,
        })

        let report = null
        let lastFailure = ''
        for (let attempt = 1; attempt <= 2 && report === null; attempt += 1) {
          throwIfAborted(exec.signal)
          const controller = new AbortController()
          const onAbort = () => controller.abort(exec.signal.reason)
          exec.signal.addEventListener('abort', onAbort, { once: true })
          if (exec.signal.aborted) controller.abort(exec.signal.reason)
          try {
            const outcome = await runChild({
              ctx,
              providerName: resolved.subagentProvider,
              parent,
              prompt,
              round,
              attempt,
              maxRounds,
              signal: controller.signal,
            })
            if (outcome.report !== null) report = outcome.report
            else lastFailure = outcome.failure
          } catch (error) {
            if (exec.signal.aborted) throw abortError(exec.signal)
            lastFailure = errorText(error)
          } finally {
            exec.signal.removeEventListener('abort', onAbort)
          }
        }

        if (report === null) {
          status = 'round-failed'
          failure = lastFailure.length > 0 ? lastFailure : 'child failed without a report'
          settled = true
          break
        }
        lastWorkerReport = report

        let verifier = null
        if (resolved.verifyCommand.length > 0) {
          verifier = await runVerifier({
            command: resolved.verifyCommand,
            cwd,
            timeoutMs: resolved.verifyTimeoutMs,
            signal: exec.signal,
          })
          throwIfAborted(exec.signal)
          lastVerifierOutputTail = verifier.output.slice(-resolved.maxFeedbackChars)
          verifierRounds.push({
            round,
            exitCode: verifier.exitCode,
            passed: verifier.passed,
            timedOut: verifier.timedOut,
          })
        }

        await appendProgress(
          progressFile,
          progressChunk({ round, report, verifier, maxFeedbackChars: resolved.maxFeedbackChars }),
        )
        throwIfAborted(exec.signal)

        if (verifier !== null && verifier.passed) {
          status = 'verified'
          settled = true
          break
        }
        if (report.status === 'blocked') {
          status = 'blocked'
          settled = true
          break
        }
        if (verifier === null && report.status === 'complete') {
          status = 'self-reported'
          settled = true
          break
        }

        previousReport = report
        previousVerifier =
          verifier === null
            ? null
            : {
                exitCode: verifier.exitCode,
                timedOut: verifier.timedOut,
                tail: verifier.output.slice(-resolved.maxFeedbackChars),
              }
      }

      if (!settled) status = 'budget-limited'

      const result = {
        status,
        roundsStarted,
        verifierRounds,
        lastVerifierOutputTail,
        lastWorkerReport,
        progressFile,
        failure,
        message: '',
      }
      result.message = renderMessage(result)
      return result
    },
  })
}

export { apply, inject, name }
