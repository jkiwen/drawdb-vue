import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attributeNamed, childNamed, childrenNamed, decodeEntities, normalizeXmlName, parseXml, textOf } from "./xml.ts";

describe("the tolerant xml reader", () => {
  it("reads the elements, the attributes and the text of a document", () => {
    const root = parseXml('<?xml version="1.0"?><Model Version="7"><Entity EntryName="users"><Attribute attributeName="id">INTEGER</Attribute></Entity></Model>');
    assert.equal(root.name, "Model");
    assert.equal(root.attributes.Version, "7");
    const entity = childNamed(root, ["Entity"])!;
    assert.equal(attributeNamed(entity, ["EntryName"]), "users");
    const attribute = childNamed(entity, ["Attribute"])!;
    assert.equal(attributeNamed(attribute, ["attributeName"]), "id");
    assert.equal(attribute.text.trim(), "INTEGER");
  });

  it("decodes the entities of a value", () => {
    assert.equal(decodeEntities("a &amp; b &lt;c&gt; &#65;"), "a & b <c> A");
    const root = parseXml("<a note='x &amp; y'>&lt;text&gt;</a>");
    assert.equal(root.attributes.note, "x & y");
    assert.equal(root.text.trim(), "<text>");
  });

  it("ignores the comments, the prolog and the doctype", () => {
    const root = parseXml('<?xml version="1.0"?><!DOCTYPE x><!-- a note --><Root><!-- inner --><Leaf/></Root>');
    assert.equal(root.name, "Root");
    assert.equal(childrenNamed(root, ["Leaf"]).length, 1);
  });

  it("reads CDATA as text", () => {
    const root = parseXml("<a><![CDATA[1 < 2]]></a>");
    assert.equal(root.text.trim(), "1 < 2");
  });

  it("recovers from unbalanced tags instead of throwing", () => {
    const root = parseXml("<Root><A><B>text</A><C/></Root>");
    assert.equal(root.name, "Root");
    const first = childNamed(root, ["A"])!;
    assert.equal(first.children[0]!.name, "B");
    assert.equal(first.children[0]!.text.trim(), "text");
    // The stray closing tag of A closed A itself, so C is a sibling of A.
    assert.deepEqual(
      childrenNamed(root, ["A", "C"]).map((node) => node.name),
      ["A", "C"],
    );
  });

  it("throws only when the document has no element at all", () => {
    assert.throws(() => parseXml("<?xml version=\"1.0\"?>"), /no element/);
  });

  it("matches the names of erwin versions ignoring case and separators", () => {
    const root = parseXml("<ERWIN><entry_name>users</entry_name></ERWIN>");
    assert.equal(normalizeXmlName("entry_name"), "entryname");
    assert.equal(textOf(root, ["EntryName"]), "users");
    assert.equal(textOf(root, ["missing"]), undefined);
  });

  it("keeps the second element of a repeated name in order", () => {
    const root = parseXml("<M><T name='b'/><T name='a'/></M>");
    assert.deepEqual(
      childrenNamed(root, ["T"]).map((node) => node.attributes.name),
      ["b", "a"],
    );
  });
});
