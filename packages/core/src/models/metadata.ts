export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | MetadataValue[]
  | { [key: string]: MetadataValue };

export type Metadata = Record<string, MetadataValue>;
