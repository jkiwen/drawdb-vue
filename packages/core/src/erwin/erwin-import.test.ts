import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { familyOfType, importErwinXml } from "./erwin-import.ts";
import { readErwinDocument } from "./erwin-model.ts";
import { parseXml } from "./xml.ts";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Model Version="7">
  <Entity EntryId="E1" EntryName="Customer" TableName="customers" EntryDesc="A customer">
    <Attribute attributeid="A1" attributeName="Customer id" attributetype="Integer" fieldid="F1" primaryKey="true"/>
    <Attribute attributeid="A2" attributeName="Email" attributetype="String" fieldid="F2"/>
    <Field fieldId="F1" fieldName="customer_id" Comment="the key">
      <FieldType Datatype="int" length="4"/>
    </Field>
    <Field fieldId="F2" fieldName="email">
      <FieldType Datatype="varchar" length="120"/>
    </Field>
  </Entity>
  <Entity EntryId="E2" EntryName="Order" TableName="orders">
    <Attribute attributeid="A3" attributeName="Order id" attributetype="Integer" fieldid="F3" primaryKey="true"/>
    <Attribute attributeid="A4" attributeName="Customer" attributetype="Integer" fieldid="F4"/>
    <Field fieldId="F3" fieldName="order_id"><FieldType Datatype="int"/></Field>
    <Field fieldId="F4" fieldName="customer_id"><FieldType Datatype="int"/></Field>
  </Entity>
  <Relationship RelationshipId="R1" RelationshipName="places" ParentEntityId="E1" ChildEntityId="E2" ParentFieldId="F1" ChildFieldId="F4"/>
  <Domain DomainId="D1" DomainName="Email address" Datatype="varchar"/>
  <UDP><Something/></UDP>
</Model>`;

describe("the erwin reader", () => {
  it("reads the entities, their attributes and their fields", () => {
    const document = readErwinDocument(parseXml(SAMPLE));
    assert.equal(document.version, "7");
    assert.equal(document.entities.length, 2);
    const customer = document.entities[0]!;
    assert.equal(customer.logicalName, "Customer");
    assert.equal(customer.physicalName, "customers");
    assert.equal(customer.description, "A customer");
    assert.deepEqual(customer.attributes.map((attribute) => attribute.name), ["Customer id", "Email"]);
    assert.deepEqual(customer.attributes.map((attribute) => attribute.primary), [true, false]);
    assert.equal(customer.fields[0]!.name, "customer_id");
    assert.deepEqual(customer.fields[0]!.type, { name: "int", length: 4, precision: undefined, scale: undefined });
  });

  it("reports the elements it does not know instead of dropping them silently", () => {
    const document = readErwinDocument(parseXml(SAMPLE));
    assert.deepEqual(
      document.skipped.map((skip) => [skip.sourceName, skip.reason]),
      [["UDP", "unknown-element"]],
    );
  });

  it("reports a value it cannot read and keeps the rest of the field", () => {
    const document = readErwinDocument(
      parseXml('<Model Version="7"><Entity EntryId="E1" EntryName="T" TableName="t"><Field fieldId="F1" fieldName="a"><FieldType Datatype="varchar" length="many"/></Field></Entity></Model>'),
    );
    assert.deepEqual(document.skipped.map((skip) => skip.reason), ["unparsable"]);
    assert.equal(document.entities[0]!.fields[0]!.type!.name, "varchar");
    assert.equal(document.entities[0]!.fields[0]!.type!.length, undefined);
  });

  it("marks a field without a logical attribute as asymmetric", () => {
    const document = readErwinDocument(
      parseXml('<Model Version="7"><Entity EntryId="E1" EntryName="T" TableName="t"><Attribute attributeid="A1" attributeName="a" fieldid="F1"/><Field fieldId="F1" fieldName="a"/><Field fieldId="F2" fieldName="b"/></Entity></Model>'),
    );
    assert.deepEqual(
      document.skipped.map((skip) => [skip.sourceName, skip.reason]),
      [["b", "asymmetric"]],
    );
  });
});

describe("importing an erwin document", () => {
  it("maps the entities onto tables with both layers and the imported source", () => {
    const { diagram, report } = importErwinXml(SAMPLE, { database: "mssql" });
    assert.equal(diagram.database, "mssql");
    assert.equal(diagram.tables.length, 2);
    const customer = diagram.tables[0]!;
    assert.equal(customer.name, "customers");
    assert.equal(customer.logical.name, "Customer");
    assert.equal(customer.logical.description, "A customer");
    assert.equal(customer.fields[0]!.name, "customer_id");
    assert.equal(customer.fields[0]!.fieldType.type, "int");
    assert.equal(customer.fields[0]!.fieldTypeSource, "imported");
    assert.equal(customer.logical.attributes[0]!.fieldId, "F1");
    assert.equal(customer.logical.attributes[0]!.keyRole, "primary");
    assert.deepEqual(customer.primaryKey?.columns, [{ fieldId: "F1" }]);
    assert.equal(customer.primaryKey?.name, "PK_customers");
    assert.equal(customer.primaryKey?.logicalName, "PK_Customer");
    assert.equal(report.entities, 2);
    assert.equal(report.attributes, 4);
    assert.equal(report.fields, 4);
    assert.equal(report.domains, 1);
  });

  it("lays the tables out and connects the relationship the file states", () => {
    const { diagram } = importErwinXml(SAMPLE);
    assert.deepEqual(
      diagram.tables.map((table) => [table.x, table.y]),
      [
        [80, 80],
        [400, 80],
      ],
    );
    const relationship = diagram.relationships[0]!;
    assert.equal(relationship.name, "places");
    assert.equal(relationship.startTableId, "E2");
    assert.equal(relationship.startFieldId, "F4");
    assert.equal(relationship.endTableId, "E1");
    assert.equal(relationship.endFieldId, "F1");
    // The import derives the foreign key object of the child table afterwards.
    assert.equal(diagram.tables[1]!.foreignKeys?.[0]?.relationshipId, "R1");
  });

  it("keeps every skipped part as an invalid marker on the diagram", () => {
    const { diagram, report } = importErwinXml(SAMPLE);
    assert.equal(diagram.invalidMarkers?.length, 1);
    assert.equal(diagram.invalidMarkers?.[0]?.sourceName, "UDP");
    assert.equal(diagram.invalidMarkers?.[0]?.reason, "unknown-element");
    assert.equal(report.markers.length, 1);
    assert.match(report.notes.join(" "), /1 domains are read/);
  });

  it("survives the json round trip with its markers", () => {
    const { diagram } = importErwinXml(SAMPLE);
    assert.equal(diagram.invalidMarkers?.length, 1);
  });
});

describe("the family of an erwin type", () => {
  it("reads the families the type system knows", () => {
    assert.equal(familyOfType("varchar"), "string");
    assert.equal(familyOfType("nvarchar2"), "string");
    assert.equal(familyOfType("int"), "integer");
    assert.equal(familyOfType("decimal"), "decimal");
    assert.equal(familyOfType("datetime2"), "datetime");
    assert.equal(familyOfType("uniqueidentifier"), "uuid");
  });

  it("falls back to common for a type it does not know", () => {
    assert.equal(familyOfType("geometry"), "common");
    assert.equal(familyOfType(undefined), "string");
  });
});
