/**
 * A small, tolerant XML reader for the erwin importer (P7).
 *
 * The importer has to read a file a user exported somewhere else without a
 * DOM in Node and without a dependency: the parser keeps the shape of the
 * document — element names, attributes, children and text — and recovers from
 * what it does not understand instead of throwing. The importer turns the
 * things it could not read into invalid markers (Q18), so a parser that
 * silently drops a subtree would hide exactly what the report has to say.
 */
export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  /** The text directly inside the element, with the entities decoded. */
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Decodes the entities of a value, leaving an unknown one as written. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x") || body.startsWith("#X")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Reads the attributes of a start tag, up to the closing bracket. */
function readAttributes(source: string, start: number): { attributes: Record<string, string>; end: number } {
  const attributes: Record<string, string> = {};
  let at = start;
  while (at < source.length) {
    while (at < source.length && /\s/.test(source[at]!)) at += 1;
    // The end of the start tag: the caller reads the ">" and the "/" itself.
    if (at >= source.length || source[at] === ">" || source[at] === "/") {
      return { attributes, end: at };
    }
    const nameStart = at;
    while (at < source.length && !/[\s=/>]/.test(source[at]!)) at += 1;
    const name = source.slice(nameStart, at);
    while (at < source.length && /\s/.test(source[at]!)) at += 1;
    if (source[at] !== "=") {
      if (name.length > 0) attributes[name] = "";
      continue;
    }
    at += 1;
    while (at < source.length && /\s/.test(source[at]!)) at += 1;
    const quote = source[at];
    if (quote !== '"' && quote !== "'") {
      const valueStart = at;
      while (at < source.length && !/[\s/>]/.test(source[at]!)) at += 1;
      if (name.length > 0) attributes[name] = decodeEntities(source.slice(valueStart, at));
      continue;
    }
    const valueStart = at + 1;
    at += 1;
    while (at < source.length && source[at] !== quote) at += 1;
    if (name.length > 0) attributes[name] = decodeEntities(source.slice(valueStart, at));
    at += 1;
  }
  return { attributes, end: at };
}

/**
 * Parses an XML document into one root node.
 *
 * The reader is lenient on purpose: an unbalanced tag closes the element that
 * is open instead of failing, and a document without a root is the only case
 * that throws, because there is nothing to import then.
 */
export function parseXml(source: string): XmlNode {
  const document: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
  const stack: XmlNode[] = [document];
  const top = (): XmlNode => stack[stack.length - 1]!;
  let at = 0;

  while (at < source.length) {
    const open = source.indexOf("<", at);
    if (open < 0) {
      top().text += decodeEntities(source.slice(at));
      break;
    }
    if (open > at) top().text += decodeEntities(source.slice(at, open));

    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      at = end < 0 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open + 9);
      top().text += end < 0 ? source.slice(open + 9) : source.slice(open + 9, end);
      at = end < 0 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<?", open) || source.startsWith("<!", open)) {
      const end = source.indexOf(">", open);
      at = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith("</", open)) {
      const end = source.indexOf(">", open);
      const name = source.slice(open + 2, end < 0 ? source.length : end).trim();
      at = end < 0 ? source.length : end + 1;
      // Close up to the element with that name; an unknown closing tag is ignored.
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth]!.name === name) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }

    const nameStart = open + 1;
    let nameEnd = nameStart;
    while (nameEnd < source.length && !/[\s/>]/.test(source[nameEnd]!)) nameEnd += 1;
    const name = source.slice(nameStart, nameEnd);
    const { attributes, end } = readAttributes(source, nameEnd);
    const node: XmlNode = { name, attributes, children: [], text: "" };
    if (name.length > 0) top().children.push(node);
    const selfClosing = source[end] === "/";
    at = selfClosing ? source.indexOf(">", end) + 1 : source.indexOf(">", end) + 1;
    if (Number.isNaN(at) || at <= 0) at = source.length;
    if (!selfClosing && name.length > 0) stack.push(node);
  }

  const root = document.children[0];
  if (!root) throw new Error("the document has no element");
  return root;
}

/** The children whose name matches one of the names, ignoring case and separators. */
/** Every element below `node` with one of `names`, in document order. */
export function descendantsNamed(node: XmlNode, names: readonly string[]): XmlNode[] {
  const wanted = names.map(normalizeXmlName);
  const found: XmlNode[] = [];
  const walk = (current: XmlNode): void => {
    for (const child of current.children) {
      if (wanted.includes(normalizeXmlName(child.name))) found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}

export function childrenNamed(node: XmlNode, names: readonly string[]): XmlNode[] {
  const wanted = new Set(names.map(normalizeXmlName));
  return node.children.filter((child) => wanted.has(normalizeXmlName(child.name)));
}

/** The first child whose name matches one of the names. */
export function childNamed(node: XmlNode, names: readonly string[]): XmlNode | undefined {
  return childrenNamed(node, names)[0];
}

/** The value of one of the attributes, ignoring case and separators. */
export function attributeNamed(node: XmlNode, names: readonly string[]): string | undefined {
  const wanted = new Set(names.map(normalizeXmlName));
  for (const [key, value] of Object.entries(node.attributes)) {
    if (wanted.has(normalizeXmlName(key))) return value;
  }
  return undefined;
}

/** The text under a child, which is what erwin puts where a reader looks for a value. */
export function textOf(node: XmlNode, names: readonly string[]): string | undefined {
  const child = childNamed(node, names);
  if (!child) return undefined;
  const value = child.text.trim();
  return value.length > 0 ? value : undefined;
}

/** Normalizes an element or attribute name to compare erwin versions (Q17). */
export function normalizeXmlName(name: string): string {
  return name.replace(/[_\-\s]/g, "").toLowerCase();
}

/** True when the char after a tag name ends it (`>`, `/`, or whitespace). */
function endsName(source: string, at: number): boolean {
  const after = source[at];
  return after === undefined || after === ">" || after === "/" || /\s/.test(after);
}

/** The next index of the tag `prefix+name` whose name is not a longer one. */
function indexOfTag(source: string, prefix: string, from: number): number {
  let at = source.indexOf(prefix, from);
  while (at >= 0) {
    if (endsName(source, at + prefix.length)) return at;
    at = source.indexOf(prefix, at + 1);
  }
  return -1;
}

/** The index just past the closing tag that matches the start tag at `from`. */
function elementEnd(source: string, name: string, from: number): number {
  let depth = 0;
  let at = from;
  while (at < source.length) {
    const nextOpen = indexOfTag(source, `<${name}`, at);
    const nextClose = indexOfTag(source, `</${name}`, at);
    if (nextClose < 0) return source.length;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      at = nextOpen + name.length + 1;
      continue;
    }
    depth -= 1;
    const end = source.indexOf(">", nextClose);
    const after = end < 0 ? source.length : end + 1;
    if (depth <= 0) return after;
    at = after;
  }
  return source.length;
}

/**
 * Walks a document once and hands over the slice of every element it wants.
 *
 * The importer never needs the whole document: for a model with hundreds of
 * tables the useful part is the entities and the keys, and the rest is
 * drawing bookkeeping. Slicing each interesting element out and parsing that
 * slice keeps memory proportional to one element instead of the file
 * (the review asked for an extraction that is not a full text scan).
 */
export function scanElements(
  source: string,
  names: readonly string[],
  onElement: (name: string, slice: string) => void,
): number {
  const wanted = names.map((name) => name.replace(/[_\-\s]/g, "").toLowerCase());
  let at = 0;
  let found = 0;
  while (at < source.length) {
    const open = source.indexOf("<", at);
    if (open < 0) break;
    let nameEnd = open + 1;
    while (nameEnd < source.length && !/[\s/>]/.test(source[nameEnd]!)) nameEnd += 1;
    const name = source.slice(open + 1, nameEnd).replace(/^[^:]+:/, "");
    if (!wanted.includes(normalizeXmlName(name))) {
      at = open + 1;
      continue;
    }
    const end = elementEnd(source, name, open);
    onElement(name, source.slice(open, end));
    found += 1;
    at = end;
  }
  return found;
}

