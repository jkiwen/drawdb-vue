import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyDiagram } from "@drawdb/core";
import { downloadDiagramJson, readDiagramJsonFile } from "./diagram-io.ts";

/** A download the test can look at instead of the browser. */
interface Download {
  name: string;
  text: string;
  clicked: boolean;
}

/** Stubs the parts of the browser the download goes through. */
function withDownload(run: (download: Download) => void) {
  const download: Download = { name: "", text: "", clicked: false };
  const url = {
    createObjectURL: (blob: Blob) => {
      void blob.text().then((text) => {
        download.text = text;
      });
      return "blob:test";
    },
    revokeObjectURL: () => undefined,
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
    download.name = this.download;
    download.clicked = true;
  };
  (globalThis as { URL: unknown }).URL = url;
  try {
    run(download);
  } finally {
    HTMLAnchorElement.prototype.click = click;
  }
  return download;
}

/** A File that reads its content without a Blob. */
function fileOf(text: string): File {
  return {
    text: () => Promise.resolve(text),
  } as unknown as File;
}

describe("diagram-io", () => {
  it("downloadDiagramJson creates a json download", async () => {
    const downloaded = withDownload(() => {
      downloadDiagramJson(createEmptyDiagram({ id: "d1", title: "Billing" }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(downloaded.name, "billing.json");
    assert.equal(downloaded.clicked, true);
    assert.match(downloaded.text, /"title": "Billing"/);
  });

  it("readDiagramJsonFile parses the file", async () => {
    const json = JSON.stringify(createEmptyDiagram({ id: "d2", title: "Analytics" }));
    const diagram = await readDiagramJsonFile(fileOf(json));
    assert.equal(diagram.title, "Analytics");
    assert.equal(diagram.id, "d2");
  });

  it("readDiagramJsonFile rejects an invalid file", async () => {
    await assert.rejects(() => readDiagramJsonFile(fileOf("{")), (error: Error) => {
      assert.equal(error.name, "ImportError");
      return true;
    });
  });
});
