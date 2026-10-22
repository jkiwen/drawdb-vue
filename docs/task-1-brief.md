## Task 1: Bootstrap Monorepo Infrastructure

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/core/package.json`
- Create: `packages/sdk/package.json`
- Create: `packages/app/package.json`
- Create: `.github/workflows/ci.yml`
- Test: `scripts/verify-workspace.test.ts`

**Interfaces:**
- Produces: workspace structure with three packages, pnpm scripts (`dev`, `build`, `test`, `lint`), shared TypeScript config.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('workspace bootstrap', () => {
  it('has three packages', () => {
    const packages = readdirSync('packages');
    expect(packages).toContain('core');
    expect(packages).toContain('sdk');
    expect(packages).toContain('app');
  });

  it('core package has correct name and exports', () => {
    const pkg = JSON.parse(readFileSync('packages/core/package.json', 'utf-8'));
    expect(pkg.name).toBe('@drawdb/core');
    expect(pkg.type).toBe('module');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/verify-workspace.test.ts`
Expected: FAIL with packages not found.

- [ ] **Step 3: Create monorepo root files**

Create `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` with exact package names and workspace globs.

- [ ] **Step 4: Create package skeletons**

Create `packages/core/package.json`, `packages/sdk/package.json`, `packages/app/package.json` with correct `name`, `type: "module"`, scripts, and devDependencies.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run scripts/verify-workspace.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: bootstrap drawdb-vue monorepo"
```

---


