import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

describe('workspace bootstrap', () => {
  it('has three packages', () => {
    const packages = readdirSync('packages');
    assert.ok(packages.includes('core'));
    assert.ok(packages.includes('sdk'));
    assert.ok(packages.includes('app'));
  });

  it('core package has correct name and type', () => {
    const pkg = JSON.parse(readFileSync('packages/core/package.json', 'utf-8'));
    assert.equal(pkg.name, '@drawdb/core');
    assert.equal(pkg.type, 'module');
  });

  it('sdk package has correct name and type', () => {
    const pkg = JSON.parse(readFileSync('packages/sdk/package.json', 'utf-8'));
    assert.equal(pkg.name, '@drawdb/vue-sdk');
    assert.equal(pkg.type, 'module');
  });

  it('app package has correct name and type', () => {
    const pkg = JSON.parse(readFileSync('packages/app/package.json', 'utf-8'));
    assert.equal(pkg.name, 'drawdb-vue-app');
    assert.equal(pkg.type, 'module');
  });

  it('workspace config includes all packages', () => {
    const workspace = readFileSync('pnpm-workspace.yaml', 'utf-8');
    assert.ok(workspace.includes('packages/*'));
  });

  it('turbo config exists and has pipeline', () => {
    const turbo = JSON.parse(readFileSync('turbo.json', 'utf-8'));
    assert.ok(turbo.pipeline);
    assert.ok(turbo.pipeline.build);
    assert.ok(turbo.pipeline.test);
  });

  it('shared typescript base config exists', () => {
    assert.ok(existsSync('tsconfig.base.json'));
    const tsconfig = JSON.parse(readFileSync('tsconfig.base.json', 'utf-8'));
    assert.equal(tsconfig.compilerOptions.strict, true);
    assert.equal(tsconfig.compilerOptions.moduleResolution, 'Bundler');
  });

  it('ci workflow exists', () => {
    assert.ok(existsSync('.github/workflows/ci.yml'));
  });
});
