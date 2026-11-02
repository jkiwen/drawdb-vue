import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import type { Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import Table from "./Table.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useViewStateStore } from "../../stores/view-state.ts";
import { useTypeScopeStore } from "../../stores/type-scope.ts";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The logical rows of the canvas label a domain-typed attribute by the name of
 * its domain. Until P8 the canvas had no way to resolve one — it printed the
 * domain id as a placeholder — because the type scope lived only in the
 * editors. The scope is the three layers the resolver reads: application,
 * workspace, and the diagram's own domains (`diagram.domains`).
 */
function seed(domainId: string): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "oraclesql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        logical: {
          id: "l_t1",
          name: "Customer",
          attributes: [
            {
              id: "a_f1",
              name: "name",
              logicalType: { domainId },
              fieldId: "f1",
            },
          ],
        },
        fields: [
          {
            id: "f1",
            name: "user_name",
            fieldType: { type: "NVARCHAR2", length: 100 },
            fieldTypeSource: "explicit",
          },
        ],
      },
    ],
    relationships: [],
    notes: [],
    subjectAreas: [],
    areas: [],
    types: [],
    enums: [],
    views: [],
    metadata: {},
  };
}

describe("the domains of the canvas labels", () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountTable(table: Diagram["tables"][number]) {
    return mount(Table, {
      props: { table },
      global: { plugins: [pinia, naive] },
    });
  }

  it("shows the name of a domain the diagram carries itself", () => {
    const diagram = seed("d_unicode");
    useDiagramStore().setDiagram({
      ...diagram,
      domains: [
        {
          id: "d_unicode",
          name: "UnicodeString",
          family: "string",
          params: { length: 100 },
        },
      ],
    });
    useViewStateStore().setViewLayer("logical");

    const wrapper = mountTable(diagram.tables[0]);
    const type = wrapper.find('[data-testid="field-type"]');
    assert.equal(type.text().trim(), "UnicodeString");
    assert.ok(
      !type.classes().includes("ddb-table__field-type--placeholder"),
      "a known domain is not a placeholder",
    );
  });

  it("shows the name of a domain that lives in the type scope", () => {
    useDiagramStore().setDiagram(seed("d_unicode"));
    useTypeScopeStore().registerDomain({
      id: "d_unicode",
      name: "UnicodeString",
      family: "string",
    });
    useViewStateStore().setViewLayer("logical");

    const wrapper = mountTable(seed("d_unicode").tables[0]);
    assert.equal(wrapper.find('[data-testid="field-type"]').text().trim(), "UnicodeString");
  });

  it("keeps the id as a placeholder when no layer knows the domain", () => {
    useDiagramStore().setDiagram(seed("d_missing"));
    useViewStateStore().setViewLayer("logical");

    const wrapper = mountTable(seed("d_missing").tables[0]);
    const type = wrapper.find('[data-testid="field-type"]');
    assert.equal(type.text().trim(), "d_missing");
    assert.ok(type.classes().includes("ddb-table__field-type--placeholder"));
  });
});
