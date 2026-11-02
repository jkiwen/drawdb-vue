import type { Diagram } from "../models/diagram.ts";
import type { CustomType } from "../models/type.ts";
import { escapeQuotes } from "./shared.ts";

/**
 * The names a diagram declares itself.
 *
 * A diagram carries two kinds of names that are not types of the dialect:
 * the enums and the custom types. Postgres materialises both, so the export
 * has to write them under the very name the diagram gives them — a name
 * that is not a bare lower case identifier (`Address`, `user role`) only
 * survives if it is quoted.
 *
 * The resolver answers the question "which name of the diagram does this
 * type name point at?" and returns `undefined` for every name the diagram
 * does not declare, so a type of the dialect stays a type of the dialect.
 */
export type TypeNameResolver = (rawType: string) => string | undefined;

/**
 * Builds the resolver of the declared names.
 *
 * The lookup is case insensitive, because a type name that is written in
 * another case still points at the same declaration. A name the dialect
 * already knows is never shadowed: `isBuiltin` is asked first, so a custom
 * type called `text` does not take the place of the type of the dialect.
 */
export function buildTypeNameResolver(
  diagram: Diagram,
  isBuiltin: (name: string) => boolean = () => false,
): TypeNameResolver {
  const declared = new Map<string, string>();

  for (const entry of diagram.enums ?? []) {
    const name = entry?.name?.trim();
    if (name && !declared.has(name.toLowerCase())) {
      declared.set(name.toLowerCase(), name);
    }
  }

  for (const entry of diagram.types ?? []) {
    const name = entry?.name?.trim();
    if (name && !declared.has(name.toLowerCase())) {
      declared.set(name.toLowerCase(), name);
    }
  }

  return (rawType: string): string | undefined => {
    const key = String(rawType ?? "").trim().toLowerCase();
    if (!key || isBuiltin(key)) return undefined;
    return declared.get(key);
  };
}

function quoteIdentifier(name: string): string {
  return `"${name}"`;
}

/**
 * Writes a custom type of the diagram as the `CREATE TYPE` of Postgres.
 *
 * The fields of the type carry the names of the dialect, so they are
 * written as they are; a field that names another custom type of the
 * diagram is written with the quoted name of that type.
 */
export function materialiseCustomType(
  type: CustomType,
  resolve: TypeNameResolver,
): string {
  const fields = (type.fields ?? [])
    .map((field) => {
      const declared = resolve(field.type);
      const fieldType = declared ? quoteIdentifier(declared) : field.type;
      return `\t${quoteIdentifier(field.name)} ${fieldType}`;
    })
    .join(",\n");

  const comment = type.comment?.trim()
    ? `\n\nCOMMENT ON TYPE ${quoteIdentifier(type.name)} IS '${escapeQuotes(type.comment)}';`
    : "";

  return `CREATE TYPE ${quoteIdentifier(type.name)} AS (\n${fields}\n);${comment}`;
}
