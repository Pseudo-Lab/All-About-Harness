const name = 'tool-web-qa';
const inject = ['tools'];

function apply(ctx) {
  ctx.tools.register({
    name: 'web_qa_plan',
    description: 'Create a Playwright-based verification plan for a local website. Returns commands and checks for screenshots, console errors, failed requests, responsive layouts, and a primary user flow.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string', required: true, description: 'Local website URL, for example http://localhost:5173.' },
        package_manager: { type: 'string', enum: ['npm', 'pnpm', 'yarn'], description: 'Package manager used by the project. Defaults to npm.' },
        mobile: { type: 'boolean', description: 'Include a mobile viewport check. Defaults to true.' }
      }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          install: { type: 'string', required: true },
          script: { type: 'string', required: true },
          checks: { type: 'array', required: true, items: { type: 'string' } }
        }
      },
      render(_args, value) {
        return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
      }
    },
    execute(args) {
      const manager = args.package_manager || 'npm';
      const install = manager === 'pnpm'
        ? 'pnpm add -D playwright'
        : manager === 'yarn'
          ? 'yarn add -D playwright'
          : 'npm install -D playwright';
      const mobile = args.mobile !== false;
      const viewports = mobile
        ? '[{ width: 1440, height: 900 }, { width: 390, height: 844 }]'
        : '[{ width: 1440, height: 900 }]';
      const script = `const { chromium } = require('playwright');\nconst browser = await chromium.launch({ headless: true });\nconst errors = [];\nfor (const viewport of ${viewports}) {\n  const page = await browser.newPage({ viewport });\n  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });\n  page.on('requestfailed', r => errors.push(r.url() + ' - ' + r.failure()?.errorText));\n  await page.goto('${args.url}', { waitUntil: 'networkidle' });\n  await page.screenshot({ path: '/tmp/web-qa-' + viewport.width + '.png', fullPage: true });\n  console.log({ viewport, title: await page.title(), errors });\n  await page.close();\n}\nawait browser.close();`;
      return {
        install,
        script,
        checks: [
          'Page loads without navigation errors',
          'Title and primary visible content are present',
          'No browser console errors',
          'No failed network requests',
          mobile ? 'Desktop and mobile screenshots are visually reviewed' : 'Desktop screenshot is visually reviewed',
          'Primary navigation or form flow is exercised'
        ]
      };
    }
  });
}

export { apply, inject, name };
