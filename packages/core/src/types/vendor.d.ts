/**
 * `@dbml/core` ships without TypeScript declarations.
 * The package is CommonJS and exposes a `Parser` class.
 */
declare module "@dbml/core" {
  export class Parser {
    parse(source: string, format: string): DBMLDatabase;
  }

  const dbmlCore: { Parser: typeof Parser };
  export default dbmlCore;
}

interface DBMLType {
  type_name: string;
  args?: string | null;
  schemaName?: string | null;
}

interface DBMLField {
  name: string;
  type: DBMLType;
  pk?: boolean;
  unique?: boolean;
  not_null?: boolean;
  increment?: boolean;
  dbdefault?: { value?: string | number | boolean | null } | null;
  note?: string | null;
}

interface DBMLIndexColumn {
  value: string;
  type?: string;
}

interface DBMLIndex {
  name?: string | null;
  unique?: boolean;
  pk?: boolean;
  columns: DBMLIndexColumn[];
}

interface DBMLTable {
  name: string;
  note?: string | null;
  headerColor?: string | null;
  fields: DBMLField[];
  indexes: DBMLIndex[];
}

interface DBMLEndpoint {
  tableName: string;
  fieldNames: string[];
  relation: string;
}

interface DBMLRef {
  name?: string | null;
  onDelete?: string;
  onUpdate?: string;
  endpoints: DBMLEndpoint[];
}

interface DBMLEnum {
  name: string;
  values: Array<{ name: string }>;
}

interface DBMLSchema {
  tables: DBMLTable[];
  refs: DBMLRef[];
  enums: DBMLEnum[];
}

interface DBMLDatabase {
  schemas: DBMLSchema[];
}
