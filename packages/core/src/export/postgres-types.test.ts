import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "../models/diagram.ts";
import {
  buildTypeNameResolver,
  materialiseCustomType,
} from "./postgres-types.ts";

function diagramWithTypes() {
  const diagram = createEmptyDiagram({ database: "postgres", title: "blog" });
  diagram.enums.push({ id: "user_role", name: "user_role", values: ["admin"] });
  diagram.types.push({
    id: "address",
    name: "Address",
    fields: [
      { id: "street", name: "street", type: "VARCHAR" },
      { id: "point", name: "point", type: "Geo" },
    ],
    comment: "A postal address",
  });
  diagram.types.push({
    id: "geo",
    name: "Geo",
    fields: [{ id: "lat", name: "lat", type: "NUMERIC" }],
  });
  return diagram;
}

describe("the names a diagram declares", () => {
  it("finds an enum and a custom type by their name, whatever its case", () => {
    const resolve = buildTypeNameResolver(diagramWithTypes());
    assert.equal(resolve("user_role"), "user_role");
    assert.equal(resolve("address"), "Address");
    assert.equal(resolve("ADDRESS"), "Address");
  });

  it("leaves a name the diagram does not declare alone", () => {
    const resolve = buildTypeNameResolver(diagramWithTypes());
    assert.equal(resolve("VARCHAR"), undefined);
    assert.equal(resolve("geometry"), undefined);
  });

  it("does not shadow a type the dialect already knows", () => {
    const diagram = diagramWithTypes();
    diagram.types.push({ id: "text", name: "text", fields: [] });
    const resolve = buildTypeNameResolver(diagram, (name) =>
      ["text", "integer", "varchar"].includes(name.toLowerCase()),
    );
    assert.equal(resolve("text"), undefined);
    assert.equal(resolve("address"), "Address");
  });
});

describe("the materialisation of a custom type", () => {
  it("writes the fields of the type under a CREATE TYPE", () => {
    const diagram = diagramWithTypes();
    const resolve = buildTypeNameResolver(diagram);
    const statement = materialiseCustomType(diagram.types[0], resolve);
    assert.match(statement, /^CREATE TYPE "Address" AS \(/);
    assert.match(statement, /	"street" VARCHAR/);
  });

  it("quotes the name of a type a field names", () => {
    const diagram = diagramWithTypes();
    const resolve = buildTypeNameResolver(diagram);
    const statement = materialiseCustomType(diagram.types[0], resolve);
    assert.match(statement, /	"point" "Geo"/);
  });

  it("writes the comment of the type", () => {
    const diagram = diagramWithTypes();
    const resolve = buildTypeNameResolver(diagram);
    const statement = materialiseCustomType(diagram.types[0], resolve);
    assert.match(statement, /COMMENT ON TYPE "Address" IS 'A postal address';/);
  });
});
