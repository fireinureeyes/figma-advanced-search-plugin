import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const testsOnly = process.argv.includes('--tests');
const production = process.argv.includes('--production');

const OUT_DIR = 'dist';

const shared = {
  bundle: true,
  target: 'es2019',
  logLevel: 'info',
  minify: true, // Always minify to strip standard JSDoc/inline comments
  legalComments: 'none', // Strip @preserve and @license comments
  sourcemap: production ? false : 'inline',
};

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

/** Sandbox bundle → dist/code.js */
async function buildMain(ctx) {
  const options = {
    ...shared,
    entryPoints: ['src/main/index.ts'],

    alias: {
    stream: 'stream-browserify',
    buffer: 'buffer',
    util: 'util'
  },
    outfile: path.join(OUT_DIR, 'code.js'),
    format: 'iife',
    // Figma's sandbox has no DOM/Node globals; keep the bundle self-contained.
    platform: 'neutral',
    mainFields: ['browser', 'module', 'main'],
  };
  if (ctx) return esbuild.context(options);
  return esbuild.build(options);
}

/**
 * UI bundle → dist/ui.html
 * Figma loads the UI as a single HTML string (`__html__`), so the JS and CSS are
 * inlined at build time instead of being loaded as separate assets.
 */
async function buildUi() {
  const result = await esbuild.build({
    ...shared,
    entryPoints: ['src/ui/main.ts'],

    alias: {
    stream: 'stream-browserify',
    buffer: 'buffer',
    util: 'util'
  },
    format: 'iife',
    platform: 'browser',
    write: false,
    outfile: 'ui.js',
  });

  const js = result.outputFiles[0].text;
  const css = await fs.readFile('src/ui/styles.css', 'utf8');
  const html = await fs.readFile('src/ui/index.html', 'utf8');

  const inlined = html
    .replace('<!--CSS-->', `<style>\n${css}\n</style>`)
    // A literal </script> anywhere in the bundle would close the tag early.
    .replace('<!--JS-->', `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);

  await fs.writeFile(path.join(OUT_DIR, 'ui.html'), inlined);
  console.log(`  dist/ui.html  ${(inlined.length / 1024).toFixed(1)}kb`);
}

/** Test bundle → dist/tests.cjs (plain node, no figma runtime needed) */
async function buildTests() {
  await esbuild.build({
    ...shared,
    minify: false,
    entryPoints: ['tests/run.ts'],
    alias: {
    stream: 'stream-browserify',
    buffer: 'buffer',
    util: 'util'
  },
    outfile: path.join(OUT_DIR, 'tests.cjs'),
    format: 'cjs',
    platform: 'node',
  });
}

await ensureOutDir();

if (testsOnly) {
  await buildTests();
  process.exit(0);
}

if (watch) {
  const mainCtx = await buildMain(true);
  await mainCtx.watch();
  await buildUi();

  const { watch: watchFs } = await import('node:fs');
  let timer;
  watchFs('src/ui', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      buildUi().catch((error) => console.error(error));
    }, 100);
  });
  console.log('watching…');
} else {
  await buildMain(false);
  await buildUi();
}
