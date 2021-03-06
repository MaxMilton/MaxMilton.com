/* eslint-disable @typescript-eslint/naming-convention */

import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
// @ts-expect-error - no included types
import url from '@rollup/plugin-url';
import { gitDescribe, postcss, purgecss } from 'minna-tools';
import { preprocess } from 'minna-ui';
import { builtinModules } from 'module';
import path from 'path';
import svelte from 'rollup-plugin-svelte';
import { terser } from 'rollup-plugin-terser';
// @ts-expect-error - no included types
import config from 'sapper/config/rollup.js';
import pkg from './package.json';

const mode = process.env.NODE_ENV;
const dev = mode === 'development';
const rootDir = path.resolve(__dirname);
const release = gitDescribe();
const dependencies = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
];

// @ts-expect-error
const onwarn = (warning, _onwarn) =>
  (warning.code === 'MISSING_EXPORT' && /'preload'/.test(warning.message)) ||
  (warning.code === 'CIRCULAR_DEPENDENCY' &&
    /[/\\](@sapper|mdast-util-to-hast|hast-util-to-html)[/\\]/.test(
      warning.message,
    )) ||
  _onwarn(warning);

const aliasOpts = {
  entries: [
    {
      find: /^##\/(.*)/,
      replacement: path.join(rootDir, 'src', '$1'),
    },
  ],
};
const purgecssOpts = {
  content: [
    // XXX: Using `__sapper__/*` requires 2 builds
    '__sapper__/export/**/*.html',
    '__sapper__/export/**/*.js',
  ],
  // debug: true, // see purged names
};
const tsOpts = {
  exclude: ['**/*.test.ts'],
  tsconfig: path.join(rootDir, 'tsconfig.json'),
};

export default {
  client: {
    input: config.client.input().replace(/\.js$/, '.ts'),
    output: config.client.output(),
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          // @ts-expect-error
          'process.browser': true,
          'process.env.APP_VERSION': JSON.stringify(release),
          'process.env.NODE_ENV': JSON.stringify(mode),
        },
      }),
      alias(aliasOpts),
      json(),
      postcss(),
      svelte({
        compilerOptions: {
          dev,
          hydratable: true,
          preserveWhitespace: true, // Results in smaller code with closure compiler
        },
        emitCss: true,
        preprocess,
      }),
      url({
        publicPath: '/client/',
        sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
      }),
      !dev && purgecss(purgecssOpts),
      resolve({
        browser: true,
        dedupe: dependencies,
      }),
      commonjs(),
      typescript(tsOpts),
      !dev && terser({ module: true }),
    ],
    onwarn,
    preserveEntrySignatures: false,
  },

  server: {
    // input: config.server.input(),
    input: { server: config.server.input().server.replace(/\.js$/, '.ts') },
    output: config.server.output(),
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          // @ts-expect-error
          'process.browser': false,
          'process.env.APP_VERSION': JSON.stringify(release),
          'process.env.NODE_ENV': JSON.stringify(mode),
        },
      }),
      alias(aliasOpts),
      json(),
      postcss(),
      svelte({
        compilerOptions: {
          dev,
          generate: 'ssr',
          hydratable: true,
          preserveWhitespace: true,
        },
        emitCss: false,
        preprocess,
      }),
      url({
        emitFiles: false, // already emitted by client build
        publicPath: '/client/',
        sourceDir: path.resolve(__dirname, 'src/node_modules/images'),
      }),
      !dev && purgecss(purgecssOpts),
      resolve({
        dedupe: dependencies,
      }),
      commonjs(),
      typescript(tsOpts),
    ],
    external: Object.keys(pkg.dependencies).concat(
      'rehype-shiki',
      builtinModules,
    ),
    onwarn,
    preserveEntrySignatures: 'strict',
  },

  serviceworker: {
    input: config.serviceworker.input().replace(/\.js$/, '.ts'),
    output: config.serviceworker.output(),
    plugins: [
      resolve(),
      replace({
        preventAssignment: true,
        values: {
          // @ts-expect-error
          'process.browser': true,
          'process.env.APP_VERSION': JSON.stringify(release),
          'process.env.NODE_ENV': JSON.stringify(mode),
        },
      }),
      commonjs(),
      typescript(tsOpts),
      !dev && terser(),
    ],
    onwarn,
    preserveEntrySignatures: false,
  },
};
