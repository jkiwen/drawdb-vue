import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLinkTarget, isLinkingTarget } from "./link-target.ts";

/** The place where a link that the user draws ends. */

function element(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

describe("the target of a link", () => {
  it("ends on the field of a handle", () => {
    const handle = element(
      '<div data-field-handle="true" data-table-id="posts" data-field-id="posts_user_id"></div>',
    );
    assert.deepEqual(resolveLinkTarget(handle), {
      tableId: "posts",
      fieldId: "posts_user_id",
    });
  });

  it("ends on the field of a row", () => {
    const row = element(
      '<div data-field-id="users_email" data-table-id="users"></div>',
    );
    assert.deepEqual(resolveLinkTarget(row), {
      tableId: "users",
      fieldId: "users_email",
    });
  });

  it("ends on the table when the link is released on the body", () => {
    const body = element('<div data-table-id="users"></div>');
    assert.deepEqual(resolveLinkTarget(body), { tableId: "users" });
  });

  it("walks up to the table when the link is released on a child", () => {
    const child = element(
      '<div data-table-id="users"><span class="name">users</span></div>',
    );
    const span = child.querySelector("span");
    assert.deepEqual(resolveLinkTarget(span), { tableId: "users" });
  });

  it("ends nowhere when the link is released on the canvas", () => {
    const canvas = element('<div data-testid="canvas"></div>');
    assert.equal(resolveLinkTarget(canvas), undefined);
  });

  it("ends nowhere when there is no element under the pointer", () => {
    assert.equal(resolveLinkTarget(null), undefined);
    assert.equal(resolveLinkTarget(undefined), undefined);
  });

  it("prefers the handle over the row and the table", () => {
    const handle = element(
      '<div data-table-id="users" data-field-id="users_email">' +
        '<div data-field-handle="true" data-table-id="users" data-field-id="users_email"></div>' +
        "</div>",
    );
    const inner = handle.firstElementChild;
    assert.deepEqual(resolveLinkTarget(inner), {
      tableId: "users",
      fieldId: "users_email",
    });
  });

  it("ignores an element without a table", () => {
    const broken = element('<div data-field-handle="true" data-field-id="f1"></div>');
    assert.equal(resolveLinkTarget(broken), undefined);
  });
});

describe("the guard of a link target", () => {
  it("accepts a target with a table", () => {
    assert.equal(isLinkingTarget({ tableId: "users" }), true);
    assert.equal(isLinkingTarget({ tableId: 1, fieldId: 2 }), true);
  });

  it("refuses a target without a table", () => {
    assert.equal(isLinkingTarget(null), false);
    assert.equal(isLinkingTarget(undefined), false);
    assert.equal(isLinkingTarget({}), false);
    assert.equal(isLinkingTarget({ tableId: null }), false);
    assert.equal(isLinkingTarget({ tableId: {} }), false);
    assert.equal(isLinkingTarget("users"), false);
  });
});
