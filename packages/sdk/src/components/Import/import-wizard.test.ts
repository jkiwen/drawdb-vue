import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ImportWizard from "./ImportWizard.vue";
import { useImportWizardStore } from "../../stores/import-wizard.ts";

const SQL = "CREATE TABLE users (id INT NOT NULL, email VARCHAR(64), PRIMARY KEY (id));";

function mountWizard() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wizard = useImportWizardStore();
  wizard.begin("sql");
  const wrapper = mount(ImportWizard, { global: { plugins: [pinia] } });
  return { wizard, wrapper };
}

describe("the import wizard", () => {
  it("opens on the source step with the formats it knows", () => {
    const { wrapper } = mountWizard();
    assert.ok(wrapper.find('[data-testid="import-wizard"]').exists());
    assert.ok(wrapper.find('[data-testid="import-step-source"]').exists());
    for (const name of ["sql", "dbml", "json", "erwin"]) {
      assert.ok(wrapper.find(`[data-testid="import-format-${name}"]`).exists(), name);
    }
  });

  it("keeps moving on shut until it has something to read", async () => {
    const { wrapper } = mountWizard();
('[data-testid="import-next"]');
    assert.equal(wrapper.find('[data-testid="import-next"]').attributes("disabled"), "");
    await wrapper.find('[data-testid="import-text"]').setValue(SQL);
    assert.equal(wrapper.find('[data-testid="import-next"]').attributes("disabled"), undefined);
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="import-step-report"]').exists());
    assert.equal(wrapper.find('[data-testid="import-count-tables"]').text(), "1");
  });

  it("walks to the decisions and imports from there", async () => {
    const { wrapper, wizard } = mountWizard();
    await wrapper.find('[data-testid="import-text"]').setValue(SQL);
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="import-step-target"]').exists());
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="import-step-conflict"]').exists());
    assert.ok(wrapper.find('[data-testid="import-conflicts-none"]').exists());
    await wrapper.find('[data-testid="import-apply"]').trigger("click");
    assert.equal(wizard.step, "apply");
    assert.ok(wrapper.find('[data-testid="import-result"]').exists());
  });

  it("shows the report of an import it cannot apply yet", async () => {
    const { wrapper } = mountWizard();
    await wrapper.find('[data-testid="import-text"]').setValue("CREATE TABLE (broken");
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="import-step-report"]').exists());
    assert.ok(wrapper.find('[data-testid="import-filter-error"]').exists());
    assert.equal(wrapper.find('[data-testid="import-next"]').attributes("disabled"), "");
  });

  it("can go back without losing the text", async () => {
    const { wrapper } = mountWizard();
    await wrapper.find('[data-testid="import-text"]').setValue(SQL);
    await wrapper.find('[data-testid="import-next"]').trigger("click");
    await wrapper.find('[data-testid="import-back"]').trigger("click");
    assert.ok(wrapper.find('[data-testid="import-step-source"]').exists());
    assert.match((wrapper.find('[data-testid="import-text"]').element as HTMLTextAreaElement).value, /CREATE TABLE users/);
  });
});
