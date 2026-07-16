import { describe, expect, it } from "vitest";
import { isAuthorized } from "./site-lock";

const header = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("isAuthorized", () => {
  it("passes everyone when no password is configured (lock off)", () => {
    expect(isAuthorized(null, undefined)).toBe(true);
    expect(isAuthorized(null, "")).toBe(true);
  });

  it("rejects missing or non-Basic headers when locked", () => {
    expect(isAuthorized(null, "s3cret")).toBe(false);
    expect(isAuthorized("Bearer abc", "s3cret")).toBe(false);
  });

  it("rejects malformed base64", () => {
    expect(isAuthorized("Basic %%%not-base64%%%", "s3cret")).toBe(false);
  });

  it("accepts the right password with any username", () => {
    expect(isAuthorized(header("prepie", "s3cret"), "s3cret")).toBe(true);
    expect(isAuthorized(header("", "s3cret"), "s3cret")).toBe(true);
  });

  it("rejects the wrong password", () => {
    expect(isAuthorized(header("prepie", "nope"), "s3cret")).toBe(false);
  });

  it("allows colons inside the password", () => {
    expect(isAuthorized(header("u", "a:b:c"), "a:b:c")).toBe(true);
  });
});
