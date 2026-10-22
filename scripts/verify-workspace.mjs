import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const packages = readdirSync('packages');
assert.ok(packages.includes('core'), 'missing packages/core');
assert.ok(packages.includes('sdk'), 'missing packages/sdk');
assert.ok(packages.includes('app'), 'missing packages/app');

const core = JSON.parse(readFileSync('packages/core/package.json', 'utf-8'));
assert.equal(core.name, '@drawdb/core');
assert.equal(core.type, 'module');

const sdk = JSON.parse(readFileSync('packages/sdk/package.json', 'utf-8'));
assert.equal(sdk.name, '@drawdb/vue-sdk');
assert.equal(sdk.type, 'module');

const app = JSON.parse(readFileSync('packages/app/package.json', 'utf-8'));
assert.equal(app.name, 'drawdb-vue-app');
assert.equal(app.type, 'module');

const workspace = readFileSync('pnpm-workspace.yaml', 'utf-8');
assert.ok(workspace.includes('packages/*'), 'missing packages/* in workspace');

const turbo = JSON.parse(readFileSync('turbo.json', 'utf-8'));
assert.ok(turbo.pipeline, 'missing pipeline');
assert.ok(turbo.pipeline.build, 'missing build pipeline');
assert.ok(turbo.pipeline.test, 'missing test pipeline');

assert.ok(existsSync('tsconfig.base.json'), 'missing tsconfig.base.json');
const tsconfig = JSON.parse(readFileSync('tsconfig.base.json', 'utf-8'));
assert.equal(tsconfig.compilerOptions.strict, true);
assert.equal(tsconfig.compilerOptions.moduleResolution, 'Bundler');

assert.ok(existsSync('.github/workflows/ci.yml'), 'missing ci.yml');

console.log('workspace bootstrap verification passed');
