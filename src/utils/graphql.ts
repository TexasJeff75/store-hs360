// GraphQL utility functions for null-safe connection handling
export const connNodes = <T = any>(conn: any): T[] =>
  conn?.edges?.map((e: any) => e?.node).filter(Boolean) ?? [];

export const pick = <T>(v: T | undefined | null, fallback: T): T =>
  v == null ? fallback : v;