return {
  name: 'official-ralph-comparison-entry',
  inject: ['experimentLoop'],
  apply(ctx) {
    harness.registerTool(ctx, harness.defineTool({
      name: 'creator_run_loop',
      description: 'Run the official Ralph controller for the comparison task.',
      parameters: { objective: { type: 'string', required: true } },
      output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute(args, exec) { return ctx.experimentLoop.run(args.objective, exec); },
    }));
  },
}
