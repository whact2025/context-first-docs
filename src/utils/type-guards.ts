/**
 * Small, reusable runtime type guards + cast helpers.
 *
 * Goal: maximize reuse of safe `is*` guards across the codebase without
 * sprinkling ad-hoc `as` casts everywhere.
 */
export type Guard<T> = (value: unknown) => value is T;

export const isUndefined: Guard<undefined> = (v: unknown): v is undefined =>
  v === undefined;

export const isNull: Guard<null> = (v: unknown): v is null => v === null;

export const isString: Guard<string> = (v: unknown): v is string =>
  typeof v === "string";

export const isNumber: Guard<number> = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const isBoolean: Guard<boolean> = (v: unknown): v is boolean =>
  typeof v === "boolean";

export const isRecord: Guard<Record<string, unknown>> = (
  v: unknown
): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function hasOwn<K extends PropertyKey>(
  v: unknown,
  key: K
): v is Record<K, unknown> {
  return isRecord(v) && Object.prototype.hasOwnProperty.call(v, key);
}

export function isArrayOf<T>(guard: Guard<T>): Guard<T[]> {
  return (v: unknown): v is T[] => Array.isArray(v) && v.every(guard);
}

export function isOptional<T>(guard: Guard<T>): Guard<T | undefined> {
  return (v: unknown): v is T | undefined => v === undefined || guard(v);
}

export function isNullable<T>(guard: Guard<T>): Guard<T | null> {
  return (v: unknown): v is T | null => v === null || guard(v);
}

export function isMaybe<T>(guard: Guard<T>): Guard<T | null | undefined> {
  return (v: unknown): v is T | null | undefined =>
    v === null || v === undefined || guard(v);
}

/**
 * Build a literal-union guard from an `as const` tuple.
 *
 * Example:
 *   const colors = ["red", "green"] as const;
 *   const isColor = isOneOf(colors);
 */
export function isOneOf<const T extends readonly (string | number | boolean)[]>(
  allowed: T
): Guard<T[number]> {
  const set = new Set<T[number]>(allowed);
  return (v: unknown): v is T[number] => set.has(v as T[number]);
}

/**
 * "Polymorphic cast" helper: return typed value if guard passes, else undefined.
 */
export function cast<T>(value: unknown, guard: Guard<T>): T | undefined {
  return guard(value) ? value : undefined;
}

/**
 * Assert helper: throws if guard fails (useful at boundaries).
 */
export function assert<T>(
  value: unknown,
  guard: Guard<T>,
  message = "Invalid value"
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message);
  }
}

