import type { ASTNode } from "./shared.ts";

/**
 * A focused DDL parser for Microsoft SQL Server.
 *
 * The `transactsql` grammar of `node-sql-parser` cannot express foreign keys
 * (`FOREIGN KEY ... REFERENCES ...` and inline `REFERENCES` clauses both fail
 * to parse), so a script containing them cannot be imported at all. This
 * parser understands the subset of T-SQL that carries diagram information —
 * `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE ... ADD CONSTRAINT` — and
 * emits the same node shapes the other importers consume.
 */
export class MSSQLParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MSSQLParseError";
  }
}

/** Remove `--` line comments, `/* *\/` block comments and `GO` batch separators. */
export function stripMSSQLNoise(sql: string): string {
  const withoutComments = stripComments(sql);
  return withoutComments.replace(/^[ \t]*GO[ \t]*$/gim, "\n");
}

/** Split a script into individual statements, ignoring `;` inside strings. */
export function splitMSSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (char === "'") {
      const end = skipString(sql, index);
      current += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) {
      statements.push(current);
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  statements.push(current);
  return statements.map((statement) => statement.trim()).filter(Boolean);
}

/**
 * Parse a T-SQL script into the AST shapes the MSSQL importer consumes.
 *
 * Statements that carry no diagram information (`CREATE VIEW`, `CREATE
 * PROCEDURE`, `SET`, ...) are ignored instead of failing the import.
 */
export function parseMSSQL(sql: string): ASTNode[] {
  const source = stripMSSQLNoise(String(sql ?? ""));
  if (!source.trim()) return [];

  const statements: ASTNode[] = [];
  for (const statement of splitMSSQLStatements(source)) {
    const parsed = parseStatement(statement);
    if (parsed) statements.push(parsed);
  }

  return statements;
}

function parseStatement(statement: string): ASTNode | undefined {
  if (/^CREATE\s+TABLE\b/i.test(statement)) return parseCreateTable(statement);
  if (/^CREATE\s+(UNIQUE\s+)?(CLUSTERED\s+|NONCLUSTERED\s+)?INDEX\b/i.test(statement)) {
    return parseCreateIndex(statement);
  }
  if (/^ALTER\s+TABLE\b/i.test(statement)) return parseAlterTable(statement);
  return undefined;
}

function parseCreateTable(statement: string): ASTNode | undefined {
  const open = statement.indexOf("(");
  if (open === -1) return undefined;

  const header = statement.slice(0, open).replace(/^CREATE\s+TABLE\s+/i, "");
  const qualified = readQualifiedName(header);
  if (!qualified) return undefined;

  const body = extractBalanced(statement, open);
  const definitions = splitTopLevel(body, ",")
    .map((item) => parseDefinition(item.trim()))
    .filter((definition): definition is ASTNode => Boolean(definition));

  return {
    type: "create",
    keyword: "table",
    table: [{ db: qualified.schema ?? null, table: qualified.name }],
    create_definitions: definitions,
    table_options: null,
  };
}

function parseCreateIndex(statement: string): ASTNode | undefined {
  const match = /^CREATE\s+(UNIQUE\s+)?(?:CLUSTERED\s+|NONCLUSTERED\s+)?INDEX\s+/i.exec(
    statement,
  );
  if (!match) return undefined;

  let rest = statement.slice(match[0].length);
  const indexName = readIdentifier(rest);
  if (!indexName) return undefined;
  rest = indexName.rest;

  const onIndex = findKeyword(rest, "ON");
  if (onIndex === -1) return undefined;
  rest = rest.slice(onIndex + 2);

  const qualified = readQualifiedName(rest);
  if (!qualified) return undefined;
  rest = qualified.rest;

  return {
    type: "create",
    keyword: "index",
    index: indexName.name,
    index_type: match[1] ? "unique" : null,
    table: { db: qualified.schema ?? null, table: qualified.name },
    index_columns: readColumnList(rest),
  };
}

function parseAlterTable(statement: string): ASTNode | undefined {
  const match = /^ALTER\s+TABLE\s+/i.exec(statement);
  if (!match) return undefined;

  let rest = statement.slice(match[0].length);
  const qualified = readQualifiedName(rest);
  if (!qualified) return undefined;
  rest = qualified.rest;

  const add = /^\s*ADD\b/i.exec(rest);
  if (!add) return undefined;
  rest = rest.slice(add[0].length);

  if (!/^\s*(CONSTRAINT\b|FOREIGN\s+KEY\b)/i.test(rest)) return undefined;

  const constraint = parseConstraint(rest.trim());
  if (!constraint) return undefined;

  return {
    type: "alter",
    table: [{ db: qualified.schema ?? null, table: qualified.name }],
    expr: [{ action: "add", create_definitions: constraint }],
  };
}

function parseDefinition(item: string): ASTNode | undefined {
  if (!item) return undefined;
  if (/^(CONSTRAINT\b|PRIMARY\s+KEY\b|UNIQUE\b|FOREIGN\s+KEY\b|CHECK\b)/i.test(item)) {
    return parseConstraint(item);
  }
  return parseColumn(item);
}

function parseConstraint(text: string): ASTNode | undefined {
  let rest = text;
  let name: string | null = null;

  const constraintKeyword = /^CONSTRAINT\s+/i.exec(rest);
  if (constraintKeyword) {
    rest = rest.slice(constraintKeyword[0].length);
    const identifier = readIdentifier(rest);
    if (!identifier) return undefined;
    name = identifier.name;
    rest = identifier.rest.trimStart();
  }

  if (/^PRIMARY\s+KEY\b/i.test(rest)) {
    return {
      resource: "constraint",
      constraint_type: "primary key",
      constraint: name,
      definition: readColumnList(rest),
    };
  }

  if (/^UNIQUE\b/i.test(rest)) {
    return {
      resource: "constraint",
      constraint_type: "unique",
      constraint: name,
      definition: readColumnList(rest),
    };
  }

  if (/^FOREIGN\s+KEY\b/i.test(rest)) {
    const columns = readColumnList(rest);
    const reference = readReferenceClause(rest);
    if (!reference) return undefined;
    return {
      resource: "constraint",
      constraint_type: "foreign key",
      constraint: name,
      definition: columns,
      reference_definition: reference.reference,
    };
  }

  return undefined;
}

function parseColumn(text: string): ASTNode | undefined {
  const identifier = readIdentifier(text);
  if (!identifier) return undefined;

  let rest = identifier.rest;
  const typeMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\([^)]*\))?/.exec(rest);
  if (!typeMatch) return undefined;

  const dataType = typeMatch[1].toUpperCase();
  const definition: ASTNode = { dataType };

  if (typeMatch[2]) {
    const inner = typeMatch[2].slice(1, -1).trim();
    if (inner && !/^max$/i.test(inner)) {
      const parts = inner.split(",").map((part) => part.trim());
      const length = Number(parts[0]);
      if (!Number.isNaN(length)) definition.length = length;
      if (parts.length > 1) {
        const scale = Number(parts[1]);
        if (!Number.isNaN(scale)) definition.scale = scale;
      }
    }
  }

  rest = rest.slice(typeMatch[0].length);

  const column: ASTNode = {
    resource: "column",
    column: { type: "column_ref", column: identifier.name },
    definition,
  };

  for (;;) {
    const trimmed = rest.trimStart();
    const attribute =
      /^(IDENTITY|NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|DEFAULT|CHECK|REFERENCES|CONSTRAINT|COLLATE)\b/i.exec(
        trimmed,
      );
    if (!attribute) break;

    const keyword = attribute[0].toUpperCase().replace(/\s+/g, " ");
    rest = trimmed.slice(attribute[0].length);

    switch (keyword) {
      case "IDENTITY": {
        column.auto_increment = { keyword: "identity", seed: null, increment: null };
        const open = rest.indexOf("(");
        if (open !== -1) {
          const inner = extractBalanced(rest, open);
          rest = rest.slice(open + inner.length + 2);
        }
        break;
      }
      case "NOT NULL": {
        column.nullable = { type: "not null", value: "not null" };
        break;
      }
      case "NULL": {
        column.nullable = { type: "null", value: "null" };
        break;
      }
      case "PRIMARY KEY": {
        column.primary_key = "primary key";
        break;
      }
      case "UNIQUE": {
        column.unique = "unique";
        break;
      }
      case "DEFAULT": {
        const parsed = readDefaultExpression(rest);
        column.default_val = { type: "default", value: parsed.value };
        rest = parsed.rest;
        break;
      }
      case "CHECK": {
        const open = rest.indexOf("(");
        if (open !== -1) {
          const inner = extractBalanced(rest, open);
          column.check = {
            constraint_type: "check",
            definition: [{ type: "raw_expression", value: inner.trim() }],
          };
          rest = rest.slice(open + inner.length + 2);
        }
        break;
      }
      case "REFERENCES": {
        const parsed = readReferenceClause("REFERENCES" + rest);
        if (!parsed) break;
        column.reference_definition = parsed.reference;
        rest = parsed.rest;
        break;
      }
      case "CONSTRAINT":
      case "COLLATE": {
        const named = readIdentifier(rest);
        if (named) rest = named.rest;
        break;
      }
    }
  }

  return column;
}

/** Read a `REFERENCES table (cols) [ON DELETE x] [ON UPDATE y]` clause. */
function readReferenceClause(
  text: string,
): { reference: ASTNode; rest: string } | undefined {
  const keywordIndex = findKeyword(text, "REFERENCES");
  if (keywordIndex === -1) return undefined;

  let rest = text.slice(keywordIndex + "REFERENCES".length).trimStart();
  const qualified = readQualifiedName(rest);
  if (!qualified) return undefined;
  rest = qualified.rest;

  let definition: ASTNode[] = [];
  const open = rest.indexOf("(");
  if (open !== -1) {
    definition = readColumnList(rest);
    const inner = extractBalanced(rest, open);
    rest = rest.slice(open + inner.length + 2);
  }

  return {
    reference: {
      table: [{ db: qualified.schema ?? null, table: qualified.name }],
      definition,
      on_action: readOnActions(rest),
    },
    rest,
  };
}

/** Collect `ON DELETE` / `ON UPDATE` referential actions from a clause. */
export function readOnActions(text: string): ASTNode[] {
  const actions: ASTNode[] = [];
  const pattern = /\bON\s+(DELETE|UPDATE)\b/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const kind = match[1].toLowerCase();
    const tail = text.slice(match.index + match[0].length).trimStart();
    const action =
      /^(NO\s+ACTION|SET\s+NULL|SET\s+DEFAULT|CASCADE|RESTRICT)/i.exec(tail);
    if (!action) continue;

    actions.push({
      type: `on ${kind}`,
      value: { value: action[0].replace(/\s+/g, " ").toLowerCase() },
    });
  }

  return actions;
}

/** Read the column list of a constraint, e.g. `(id, tenant_id)`. */
function readColumnList(text: string): ASTNode[] {
  const open = text.indexOf("(");
  if (open === -1) return [];

  const inner = extractBalanced(text, open);
  return splitTopLevel(inner, ",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => ({ column: unquote(column.split(/\s+/)[0]) }));
}

/** Read a default value expression and the text that follows it. */
function readDefaultExpression(text: string): { value: ASTNode; rest: string } {
  const source = text.trimStart();

  if (source.startsWith("(")) {
    const inner = extractBalanced(source, 0);
    const parsed = readDefaultExpression(inner);
    return { value: parsed.value, rest: source.slice(inner.length + 2) };
  }

  const call = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(source);
  if (call) {
    const open = source.indexOf("(");
    const inner = extractBalanced(source, open);
    const args = splitTopLevel(inner, ",")
      .map((argument) => argument.trim())
      .filter(Boolean)
      .map((argument) => readLiteral(argument));
    return {
      value: {
        type: "function",
        name: { name: [{ value: call[1] }] },
        args: { value: args },
      },
      rest: source.slice(open + inner.length + 2),
    };
  }

  const quoted = /^'(?:[^']|'')*'/.exec(source);
  if (quoted) {
    return {
      value: {
        type: "single_quote_string",
        value: quoted[0].slice(1, -1).replace(/''/g, "'"),
      },
      rest: source.slice(quoted[0].length),
    };
  }

  const number = /^-?\d+(\.\d+)?/.exec(source);
  if (number) {
    return {
      value: { type: "number", value: Number(number[0]) },
      rest: source.slice(number[0].length),
    };
  }

  const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source);
  if (word) {
    const upper = word[0].toUpperCase();
    return {
      value:
        upper === "NULL"
          ? { type: "null", value: null }
          : { type: "origin", value: upper },
      rest: source.slice(word[0].length),
    };
  }

  return { value: { type: "origin", value: "" }, rest: source };
}

function readLiteral(text: string): ASTNode {
  const trimmed = text.trim();

  const quoted = /^'(?:[^']|'')*'/.exec(trimmed);
  if (quoted) {
    return {
      type: "single_quote_string",
      value: quoted[0].slice(1, -1).replace(/''/g, "'"),
    };
  }

  const number = /^-?\d+(\.\d+)?/.exec(trimmed);
  if (number) return { type: "number", value: Number(number[0]) };

  const call = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(trimmed);
  if (call) {
    const open = trimmed.indexOf("(");
    const inner = extractBalanced(trimmed, open);
    const args = splitTopLevel(inner, ",")
      .map((argument) => argument.trim())
      .filter(Boolean)
      .map((argument) => readLiteral(argument));
    return {
      type: "function",
      name: { name: [{ value: call[1] }] },
      args: { value: args },
    };
  }

  return { type: "origin", value: trimmed.toUpperCase() };
}

/** Read a possibly qualified identifier, e.g. `[dbo].[users]` or `users`. */
function readQualifiedName(text: string):
  | { schema: string | null; name: string; rest: string }
  | undefined {
  let rest = text.trimStart();
  const first = readIdentifier(rest);
  if (!first) return undefined;
  rest = first.rest.trimStart();

  if (rest.startsWith(".")) {
    const second = readIdentifier(rest.slice(1));
    if (second) {
      return { schema: first.name, name: second.name, rest: second.rest };
    }
  }

  return { schema: null, name: first.name, rest: first.rest };
}

/** Read a single identifier, honouring `[bracket]` and `"quote"` forms. */
function readIdentifier(text: string): { name: string; rest: string } | undefined {
  const source = text.trimStart();

  if (source.startsWith("[")) {
    const end = source.indexOf("]");
    if (end === -1) return undefined;
    return { name: source.slice(1, end), rest: source.slice(end + 1) };
  }

  if (source.startsWith('"')) {
    const end = source.indexOf('"', 1);
    if (end === -1) return undefined;
    return { name: source.slice(1, end), rest: source.slice(end + 1) };
  }

  const match = /^[A-Za-z_#@][A-Za-z0-9_$#@]*/.exec(source);
  if (!match) return undefined;
  return { name: match[0], rest: source.slice(match[0].length) };
}

/** Remove the quoting from an identifier. */
function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Find a keyword outside of quotes, ignoring case. */
function findKeyword(text: string, keyword: string): number {
  const upper = text.toUpperCase();
  const needle = keyword.toUpperCase();
  let index = upper.indexOf(needle);
  while (index !== -1) {
    const before = index === 0 ? " " : upper[index - 1];
    const after = upper[index + needle.length] ?? " ";
    if (!/[A-Z0-9_]/.test(before) && !/[A-Z0-9_]/.test(after)) return index;
    index = upper.indexOf(needle, index + 1);
  }
  return -1;
}

/** Split text on a separator, ignoring separators inside quotes or parentheses. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === "'") {
      const end = skipString(text, index);
      current += text.slice(index, end);
      index = end;
      continue;
    }

    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);

    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  parts.push(current);
  return parts;
}

/** Return the index just after the string literal starting at `start`. */
function skipString(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "'" && text[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (text[index] === "'") return index + 1;
    index += 1;
  }
  return index;
}

/** Return the content of the parenthesis group that starts at `open`. */
function extractBalanced(text: string, open: number): string {
  let depth = 0;
  let index = open;

  while (index < text.length) {
    const char = text[index];

    if (char === "'") {
      index = skipString(text, index);
      continue;
    }

    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }

    index += 1;
  }

  return text.slice(open + 1);
}

/** Remove comments from a script while keeping string literals intact. */
function stripComments(sql: string): string {
  let out = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (char === "'") {
      const end = skipString(sql, index);
      out += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === "-" && sql[index + 1] === "-") {
      while (index < sql.length && sql[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && sql[index + 1] === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}
