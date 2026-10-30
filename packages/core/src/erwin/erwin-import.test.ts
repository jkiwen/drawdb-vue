import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importErwinXml } from "./erwin-import.ts";
import { readErwinDocument, readErwinVersion, readDataType } from "./erwin-model.ts";
import { exportDiagramJson } from "../serialize/export.ts";
import { importDiagramJson } from "../serialize/import.ts";

/** A slice of an XML Standard File shaped like the review sample (7.3.1822). */
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ERwin FileVersion="7.3.1822" Format="ERwin" xmlns="http://www.ca.com/erwin">
<EMX:Model>
  <Entity id="{E1}+00000000" name="Customer">
    <EntityProps>
      <Name>Customer</Name>
      <Physical_Name>customers</Physical_Name>
      <Comment>A customer</Comment>
      <Definition>People who buy</Definition>
    </EntityProps>
    <Attribute id="{A1}+00000000" name="Customer id">
      <AttributeProps>
        <Name>Customer id</Name>
        <Physical_Name>customer_id</Physical_Name>
        <Logical_Data_Type>INTEGER</Logical_Data_Type>
        <Physical_Data_Type>INT(4)</Physical_Data_Type>
        <Null_Option_Type>1</Null_Option_Type>
        <Comment>the key</Comment>
      </AttributeProps>
    </Attribute>
    <Attribute id="{A2}+00000000" name="Email">
      <AttributeProps>
        <Name>Email</Name>
        <Physical_Name>email</Physical_Name>
        <Logical_Data_Type>VARCHAR(120)</Logical_Data_Type>
        <Physical_Data_Type>VARCHAR2(120)</Physical_Data_Type>
        <Null_Option_Type>0</Null_Option_Type>
      </AttributeProps>
    </Attribute>
  </Entity>
  <Entity id="{E2}+00000000" name="Order">
    <EntityProps>
      <Name>Order</Name>
      <Physical_Name>orders</Physical_Name>
    </EntityProps>
    <Attribute id="{A3}+00000000" name="Order id">
      <AttributeProps>
        <Name>Order id</Name>
        <Physical_Name>order_id</Physical_Name>
        <Logical_Data_Type>INTEGER</Logical_Data_Type>
        <Physical_Data_Type>INT(4)</Physical_Data_Type>
        <Null_Option_Type>1</Null_Option_Type>
      </AttributeProps>
    </Attribute>
    <Attribute id="{A4}+00000000" name="Customer">
      <AttributeProps>
        <Name>Customer</Name>
        <Physical_Name>customer_id</Physical_Name>
        <Logical_Data_Type>INTEGER</Logical_Data_Type>
        <Physical_Data_Type>INT(4)</Physical_Data_Type>
        <Null_Option_Type>0</Null_Option_Type>
        <Parent_Domain_Ref>{D1}+00000000</Parent_Domain_Ref>
      </AttributeProps>
    </Attribute>
  </Entity>
  <Domain id="{D1}+00000000" name="Email address">
    <DomainProps>
      <Built_In_Id>0</Built_In_Id>
      <Name>Email address</Name>
      <Logical_Data_Type>CHAR(18)</Logical_Data_Type>
    </DomainProps>
  </Domain>
  <Key_Group id="{K1}+00000000" name="PK_customers">
    <Key_GroupProps>
      <Name>PK_customers</Name>
      <Key_Group_Type>PK</Key_Group_Type>
      <Physical_Name>PK_customers</Physical_Name>
      <Constraint_Name>PK_customers</Constraint_Name>
      <Is_Unique>true</Is_Unique>
      <Key_Group_Members_Order_Ref_Array>
        <Key_Group_Members_Order_Ref index="1">{M1}+00000000</Key_Group_Members_Order_Ref>
      </Key_Group_Members_Order_Ref_Array>
      <Key_Group_Member_Groups>
        <Key_Group_Member id="{M1}+00000000" name="member">
          <Key_Group_MemberProps>
            <Attribute_Ref>{A1}+00000000</Attribute_Ref>
            <Key_Group_Sort_Order>ASC</Key_Group_Sort_Order>
          </Key_Group_MemberProps>
        </Key_Group_Member>
      </Key_Group_Member_Groups>
    </Key_GroupProps>
  </Key_Group>
  <Key_Group id="{K2}+00000000" name="AK_customers_email">
    <Key_GroupProps>
      <Name>AK_customers_email</Name>
      <Key_Group_Type>AK</Key_Group_Type>
      <Is_Unique>true</Is_Unique>
      <Key_Group_Members_Order_Ref_Array>
        <Key_Group_Members_Order_Ref index="1">{M2}+00000000</Key_Group_Members_Order_Ref>
      </Key_Group_Members_Order_Ref_Array>
      <Key_Group_Member_Groups>
        <Key_Group_Member id="{M2}+00000000" name="member">
          <Key_Group_MemberProps>
            <Attribute_Ref>{A2}+00000000</Attribute_Ref>
            <Key_Group_Sort_Order>ASC</Key_Group_Sort_Order>
          </Key_Group_MemberProps>
        </Key_Group_Member>
      </Key_Group_Member_Groups>
    </Key_GroupProps>
  </Key_Group>
  <Key_Group id="{K3}+00000000" name="PK_orders">
    <Key_GroupProps>
      <Name>PK_orders</Name>
      <Key_Group_Type>PK</Key_Group_Type>
      <Key_Group_Members_Order_Ref_Array>
        <Key_Group_Members_Order_Ref index="1">{M3}+00000000</Key_Group_Members_Order_Ref>
      </Key_Group_Members_Order_Ref_Array>
      <Key_Group_Member_Groups>
        <Key_Group_Member id="{M3}+00000000" name="member">
          <Key_Group_MemberProps>
            <Attribute_Ref>{A3}+00000000</Attribute_Ref>
            <Key_Group_Sort_Order>ASC</Key_Group_Sort_Order>
          </Key_Group_MemberProps>
        </Key_Group_Member>
      </Key_Group_Member_Groups>
    </Key_GroupProps>
  </Key_Group>
  <Key_Group id="{K4}+00000000" name="FK_orders_customer">
    <Key_GroupProps>
      <Name>FK_orders_customer</Name>
      <Key_Group_Type>FK</Key_Group_Type>
      <Key_Group_Members_Order_Ref_Array>
        <Key_Group_Members_Order_Ref index="1">{M4}+00000000</Key_Group_Members_Order_Ref>
      </Key_Group_Members_Order_Ref_Array>
      <Key_Group_Member_Groups>
        <Key_Group_Member id="{M4}+00000000" name="member">
          <Key_Group_MemberProps>
            <Attribute_Ref>{A4}+00000000</Attribute_Ref>
            <Key_Group_Sort_Order>ASC</Key_Group_Sort_Order>
          </Key_Group_MemberProps>
        </Key_Group_Member>
      </Key_Group_Member_Groups>
    </Key_GroupProps>
  </Key_Group>
  <Key_Group id="{K5}+00000000" name="IE_customers">
    <Key_GroupProps>
      <Name>IE_customers</Name>
      <Key_Group_Type>Z9</Key_Group_Type>
    </Key_GroupProps>
  </Key_Group>
  <Relationship id="{R1}+00000000" name="places">
    <RelationshipProps>
      <Name>places</Name>
      <Physical_Name>FK_orders_customer</Physical_Name>
      <Cardinality>-3</Cardinality>
      <Key_Group_Ref>{K4}+00000000</Key_Group_Ref>
      <Parent_Entity_Ref>{E1}+00000000</Parent_Entity_Ref>
      <Child_Entity_Ref>{E2}+00000000</Child_Entity_Ref>
    </RelationshipProps>
  </Relationship>
  <Drawing_Objects_Ref_Array>
    <Drawing_Objects_Ref index="1">{E1}+00000000</Drawing_Objects_Ref>
  </Drawing_Objects_Ref_Array>
</EMX:Model>
</ERwin>`;

describe("the erwin reader", () => {
  it("reads the file version from the root element", () => {
    assert.equal(readErwinVersion(SAMPLE), "7.3.1822");
    assert.equal(readErwinVersion("<ERwin/>"), "unknown");
    assert.equal(readErwinVersion("no xml here"), "unknown");
  });

  it("splits a data type into its name and its numbers", () => {
    assert.deepEqual(readDataType("VARCHAR2(32)"), { name: "VARCHAR2", raw: "VARCHAR2(32)", length: 32 });
    assert.deepEqual(readDataType("NUMBER(10,2)"), { name: "NUMBER", raw: "NUMBER(10,2)", precision: 10, scale: 2 });
    assert.deepEqual(readDataType("DATE"), { name: "DATE", raw: "DATE" });
    assert.equal(readDataType(undefined), undefined);
    assert.equal(readDataType("  "), undefined);
  });

  it("reads the entities under the model, whatever their namespace", () => {
    const document = readErwinDocument(SAMPLE);
    assert.deepEqual(
      document.entities.map((entity) => [entity.name, entity.physicalName]),
      [
        ["Customer", "customers"],
        ["Order", "orders"],
      ],
    );
    const customer = document.entities[0]!;
    assert.equal(customer.comment, "A customer");
    assert.equal(customer.definition, "People who buy");
    assert.deepEqual(
      customer.attributes.map((attribute) => attribute.name),
      ["Customer id", "Email"],
    );
    assert.deepEqual(customer.attributes[0]!.physicalType, { name: "INT", raw: "INT(4)", length: 4 });
    assert.equal(customer.attributes[0]!.notNull, true);
    assert.equal(customer.attributes[1]!.notNull, undefined);
  });

  it("reads the domains and the key groups", () => {
    const document = readErwinDocument(SAMPLE);
    assert.deepEqual(
      document.domains.map((domain) => domain.name),
      ["Email address"],
    );
    assert.deepEqual(
      document.keyGroups.map((key) => [key.name, key.kind]),
      [
        ["PK_customers", "primary"],
        ["AK_customers_email", "unique"],
        ["PK_orders", "primary"],
        ["FK_orders_customer", "foreign"],
        ["IE_customers", "other"],
      ],
    );
    assert.deepEqual(document.keyGroups[0]!.members, [{ attributeId: "{A1}+00000000", order: "asc" }]);
    assert.ok(document.skipped.some((skip) => skip.reason === "unsupported"));
  });

  it("reads the relationships with both ends and the key group", () => {
    const document = readErwinDocument(SAMPLE);
    assert.equal(document.relationships.length, 1);
    const relationship = document.relationships[0]!;
    assert.equal(relationship.name, "places");
    assert.equal(relationship.physicalName, "FK_orders_customer");
    assert.equal(relationship.parentEntityId, "{E1}+00000000");
    assert.equal(relationship.childEntityId, "{E2}+00000000");
    assert.equal(relationship.keyGroupId, "{K4}+00000000");
  });

  it("does not inspect the drawing bookkeeping as if it were a model", () => {
    const document = readErwinDocument(SAMPLE);
    assert.equal(document.entities.length, 2);
    assert.equal(document.domains.length, 1);
    assert.ok(!document.skipped.some((skip) => skip.sourceName === "Drawing_Objects_Ref_Array"));
  });
});

describe("the erwin import", () => {
  it("makes a table of every entity with its logical name and its columns", () => {
    const { diagram } = importErwinXml(SAMPLE);
    assert.deepEqual(
      diagram.tables.map((table) => [table.name, table.logical.name]),
      [
        ["customers", "Customer"],
        ["orders", "Order"],
      ],
    );
    const customers = diagram.tables[0]!;
    assert.deepEqual(
      customers.fields.map((field) => [field.name, field.fieldType.type, field.fieldTypeSource]),
      [
        ["customer_id", "INT", "imported"],
        ["email", "VARCHAR2", "imported"],
      ],
    );
    assert.equal(customers.fields[0]!.comment, "the key");
    assert.equal(customers.logical.description, "A customer");
  });

  it("names the keys of an entity after the key groups of the file", () => {
    const { diagram } = importErwinXml(SAMPLE);
    const customers = diagram.tables[0]!;
    assert.equal(customers.primaryKey?.name, "PK_customers");
    assert.deepEqual(customers.primaryKey?.columns, [{ fieldId: "{A1}+00000000", order: "asc" }]);
    assert.deepEqual(
      customers.uniqueKeys?.map((key) => [key.name, key.columns]),
      [["AK_customers_email", [{ fieldId: "{A2}+00000000", order: "asc" }]]],
    );
    assert.deepEqual(
      customers.logical.attributes.map((attribute) => attribute.keyRole),
      ["primary", "alternate"],
    );
  });

  it("makes a relationship out of the file's relationship and its key group", () => {
    const { diagram } = importErwinXml(SAMPLE);
    assert.equal(diagram.relationships.length, 1);
    const relationship = diagram.relationships[0]!;
    assert.equal(relationship.name, "FK_orders_customer");
    assert.equal(relationship.startTableId, "{E2}+00000000");
    assert.equal(relationship.endTableId, "{E1}+00000000");
    assert.deepEqual(relationship.fields, [{ startFieldId: "{A4}+00000000", endFieldId: "{A1}+00000000" }]);
    assert.deepEqual(
      diagram.tables[1]!.foreignKeys?.map((key) => [key.name, key.relationshipId]),
      [["FK_orders_customer", "{R1}+00000000"]],
    );
  });

  it("reports what it read and keeps every skip as a marker", () => {
    const { diagram, report } = importErwinXml(SAMPLE);
    assert.equal(report.version, "7.3.1822");
    assert.equal(report.entities, 2);
    assert.equal(report.attributes, 4);
    assert.equal(report.domains, 1);
    assert.equal(report.keys, 5);
    assert.equal(report.relationships, 1);
    assert.ok(report.notes.some((note) => note.includes("custom logical types")));
    assert.equal(diagram.invalidMarkers?.length, report.skipped.length);
    for (const marker of diagram.invalidMarkers ?? []) {
      assert.ok(typeof marker.ownerId === "string");
      assert.ok(typeof marker.path === "string");
      assert.ok(typeof marker.sourceName === "string");
    }
  });

  it("reads a document with hundreds of entities in one pass", () => {
    const entities = Array.from({ length: 600 }, (_, index) => {
      const id = `{T${index}}+00000000`;
      return `<Entity id="${id}" name="Table ${index}"><EntityProps><Name>Table ${index}</Name><Physical_Name>T_${index}</Physical_Name></EntityProps><Attribute id="{T${index}A}+00000000" name="Id"><AttributeProps><Name>Id</Name><Physical_Name>id</Physical_Name><Physical_Type>INT</Physical_Type><Physical_Data_Type>INT</Physical_Data_Type></AttributeProps></Attribute></Entity>`;
    }).join("");
    const source = `<ERwin FileVersion="7.3.1822"><EMX:Model>${entities}</EMX:Model></ERwin>`;
    const started = Date.now();
    const { diagram, report } = importErwinXml(source);
    const took = Date.now() - started;
    assert.equal(report.entities, 600);
    assert.equal(diagram.tables.length, 600);
    assert.ok(took < 4000, `reading 600 entities took ${took}ms`);
  });

  it("reads the sample of the review without losing its keys", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sample = join(here, "..", "..", "..", "..", "fixtures", "erwin", "DEVSV_MessageCenter.xml");
    if (!existsSync(sample)) return;
    const { diagram, report } = importErwinXml(readFileSync(sample, "utf8"));
    assert.equal(report.version, "7.3.1822");
    assert.equal(report.entities, 22);
    assert.equal(diagram.tables.length, 22);
    assert.equal(
      diagram.tables.reduce((total, table) => total + table.fields.length, 0),
      139,
    );
    assert.ok(diagram.tables.filter((table) => table.primaryKey !== undefined).length >= 19);
    assert.equal(diagram.relationships.length, 15);
    assert.ok(diagram.tables.some((table) => (table.indices?.length ?? 0) > 0));
  });
});

describe("the custom logical types of the model", () => {
  it("keeps the domains the model declares as diagram-level logical types", () => {
    const { diagram, report } = importErwinXml(SAMPLE);
    assert.deepEqual(
      (diagram.domains ?? []).map((domain) => [domain.name, domain.family, domain.params]),
      [["Email address", "string", { length: 18 }]],
    );
    assert.ok(report.notes.some((note) => note.includes("1 custom logical types")));
  });

  it("types an attribute by the domain it names, not by the type the domain spells", () => {
    const { diagram } = importErwinXml(SAMPLE);
    const orders = diagram.tables.find((table) => table.name === "orders");
    const customer = orders?.logical.attributes.find((attribute) => attribute.name === "Customer");
    assert.deepEqual(customer?.logicalType, { domainId: "domain_{D1}+00000000" });
  });

  it("survives the round trip through the diagram json", () => {
    const { diagram } = importErwinXml(SAMPLE);
    const again = importDiagramJson(exportDiagramJson(diagram));
    assert.deepEqual(again.domains, diagram.domains);
    assert.deepEqual(
      again.tables.flatMap((table) => table.logical.attributes.map((attribute) => attribute.logicalType)),
      diagram.tables.flatMap((table) => table.logical.attributes.map((attribute) => attribute.logicalType)),
    );
  });
});
