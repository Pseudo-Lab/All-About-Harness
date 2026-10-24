// Submitted to cordis_define with the reviewed loop inserted by the builder.
/*__RALPH_CORE__*/

return {
  name: 'creator-coding-ralph',
  inject: ['ralphHost'],
  apply(ctx) {
    harness.registerTool(ctx, harness.defineTool({
      name: 'creator_run_loop',
      description: 'Directly control fresh implementation/test rounds, handoff, and verified termination.',
      parameters: { objective: { type: 'string', required: true } },
      output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute(args, exec) {
        // Host owns IO and lifecycle; this VM callback owns every loop iteration.
        return ctx.ralphHost.withRun(args.objective, exec, runtime => runRalph(runtime));
      },
    }));
  },
}
