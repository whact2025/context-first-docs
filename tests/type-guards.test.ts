import { describe, expect, it } from "@jest/globals";

import {
  assert,
  cast,
  hasOwn,
  isArrayOf,
  isBoolean,
  isMaybe,
  isNull,
  isNullable,
  isNumber,
  isOneOf,
  isOptional,
  isRecord,
  isString,
  isUndefined,
} from "../src/utils/type-guards.js";

describe("type-guards", () => {
  it("primitive guards should behave correctly", () => {
    expect(isUndefined(undefined)).toBe(true);
    expect(isUndefined(null)).toBe(false);

    expect(isNull(null)).toBe(true);
    expect(isNull(undefined)).toBe(false);

    expect(isString("x")).toBe(true);
    expect(isString(123)).toBe(false);

    expect(isNumber(1)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber(Infinity)).toBe(false);
    expect(isNumber("1")).toBe(false);

    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean("false")).toBe(false);
  });

  it("record + hasOwn should validate objects safely", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);

    const obj = { a: 1 };
    expect(hasOwn(obj, "a")).toBe(true);
    expect(hasOwn(obj, "b")).toBe(false);

    const inherited = Object.create({ a: 1 }) as unknown;
    expect(hasOwn(inherited, "a")).toBe(false);
    expect(hasOwn(null, "a")).toBe(false);
  });

  it("combinators should compose guards", () => {
    const isStringArray = isArrayOf(isString);
    expect(isStringArray(["a", "b"])).toBe(true);
    expect(isStringArray(["a", 1] as unknown)).toBe(false);
    expect(isStringArray("nope")).toBe(false);

    const optString = isOptional(isString);
    expect(optString(undefined)).toBe(true);
    expect(optString("x")).toBe(true);
    expect(optString(1)).toBe(false);

    const nullableString = isNullable(isString);
    expect(nullableString(null)).toBe(true);
    expect(nullableString("x")).toBe(true);
    expect(nullableString(undefined)).toBe(false);

    const maybeString = isMaybe(isString);
    expect(maybeString(undefined)).toBe(true);
    expect(maybeString(null)).toBe(true);
    expect(maybeString("x")).toBe(true);
    expect(maybeString(1)).toBe(false);
  });

  it("isOneOf should create a literal-union guard", () => {
    const colors = ["red", "green"] as const;
    const isColor = isOneOf(colors);
    expect(isColor("red")).toBe(true);
    expect(isColor("green")).toBe(true);
    expect(isColor("blue")).toBe(false);
    expect(isColor(1)).toBe(false);
  });

  it("cast + assert should narrow or throw", () => {
    expect(cast("x", isString)).toBe("x");
    expect(cast(1, isString)).toBeUndefined();

    expect(() => assert("x", isString)).not.toThrow();
    expect(() => assert(1, isString, "nope")).toThrow("nope");
  });
});

