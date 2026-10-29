import assert from "node:assert/strict";
import test from "node:test";

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { BUILTIN_FAMILIES } from "@drawdb/core";

import TypeSystemDialog from "./TypeSystemDialog.vue";
import { TYPE_SCOPE_STORAGE_KEY, useTypeScopeStore } from "../../stores/type-scope.ts";

function mountDialog() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(TypeSystemDialog, {
    props: { open: true },
    global: { plugins: [pinia] },
  });
  return { wrapper, scope: useTypeScopeStore() };
}

test("lists every builtin family on the left", () => {
  localStorage.removeItem(TYPE_SCOPE_STORAGE_KEY);
  const { wrapper } = mountDialog();

  for (const family of BUILTIN_FAMILIES) {
    assert.ok(
      wrapper.find(`[data-testid="type-system-family-${family.id}"]`).exists(),
      `the family ${family.id} is listed`,
    );
  }
  wrapper.unmount();
});

test("shows the mappings of the chosen family for every dialect", () => {
  localStorage.removeItem(TYPE_SCOPE_STORAGE_KEY);
  const { wrapper } = mountDialog();

  // The first family is chosen on open, so its grid is already up.
  for (const database of ["generic", "mysql", "postgres", "sqlite", "mssql", "oraclesql", "mariadb"]) {
    assert.ok(
      wrapper.find(`[data-testid="type-system-type-string-${database}"]`).exists(),
      `the ${database} row is shown`,
    );
  }
  wrapper.unmount();
});

test("writes an edited mapping into the scope", async () => {
  localStorage.removeItem(TYPE_SCOPE_STORAGE_KEY);
  const { wrapper, scope } = mountDialog();

  const input = wrapper.find('[data-testid="type-system-type-string-mysql"]');
  (input.element as HTMLInputElement).value = "TINYTEXT";
  await input.trigger("change");

  assert.equal(
    scope.getSnapshot().application.families?.string?.mappings?.mysql?.type,
    "TINYTEXT",
  );
  wrapper.unmount();
});

test("creates a domain through the form and reports a taken name", async () => {
  localStorage.removeItem(TYPE_SCOPE_STORAGE_KEY);
  const { wrapper, scope } = mountDialog();

  await wrapper.find('[data-testid="type-system-tab-domains"]').trigger("click");
  assert.ok(wrapper.find('[data-testid="type-system-domain-empty"]').exists());

  await wrapper.find('[data-testid="type-system-domain-create"]').trigger("click");
  const name = wrapper.find('[data-testid="type-system-domain-name"]');
  (name.element as HTMLInputElement).value = "code";
  await name.trigger("input");
  await wrapper.find('[data-testid="type-system-domain-confirm"]').trigger("click");

  assert.deepEqual(
    scope.domains.map((domain) => domain.name),
    ["code"],
  );

  // The same name again is refused with the diagnostic in the form.
  if (wrapper.find('[data-testid="type-system-domain-create"]').exists()) {
    await wrapper.find('[data-testid="type-system-domain-create"]').trigger("click");
  }
  const second = wrapper.find('[data-testid="type-system-domain-name"]');
  (second.element as HTMLInputElement).value = "Code";
  await second.trigger("input");
  await wrapper.find('[data-testid="type-system-domain-confirm"]').trigger("click");

  assert.equal(wrapper.find('[data-testid="type-system-diagnostic"]').exists(), true);
  assert.equal(scope.domains.length, 1);
  wrapper.unmount();
});
