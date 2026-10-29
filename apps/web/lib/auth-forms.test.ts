import { describe, expect, it } from "vitest";
import {
  normalisePhone,
  validateOtp,
  validatePhone,
  validateSignIn,
  validateSignUp,
} from "./auth-forms";

describe("validateSignUp", () => {
  const valid = {
    name: " Asha Rao ",
    email: "Asha@Example.test",
    password: "long enough pass",
    confirm: "long enough pass",
  };

  it("trims the name and lower-cases the email", () => {
    expect(validateSignUp(valid)).toEqual({
      ok: true,
      data: { name: "Asha Rao", email: "asha@example.test", password: "long enough pass" },
    });
  });

  it("reports every problem by field", () => {
    expect(
      validateSignUp({ name: "", email: "nope", password: "short", confirm: "different" }),
    ).toEqual({
      ok: false,
      errors: {
        name: "Enter your name",
        email: "Enter a valid email address",
        password: "Use at least 10 characters",
        confirm: "Passwords do not match",
      },
    });
  });

  it("caps the password length", () => {
    const long = "x".repeat(129);
    expect(validateSignUp({ ...valid, password: long, confirm: long })).toMatchObject({
      ok: false,
      errors: { password: "Use at most 128 characters" },
    });
  });
});

describe("validateSignIn", () => {
  it("needs an email and a password", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      ok: false,
      errors: { email: "Enter a valid email address", password: "Enter your password" },
    });
    expect(validateSignIn({ email: "a@b.test", password: "x" })).toEqual({
      ok: true,
      data: { email: "a@b.test", password: "x" },
    });
  });
});

describe("normalisePhone", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["+14155552671", "+14155552671"],
    ["12345", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });
});

describe("validatePhone / validateOtp", () => {
  it("returns the E.164 number or a field error", () => {
    expect(validatePhone({ phone: "9876543210" })).toEqual({
      ok: true,
      data: { phone: "+919876543210" },
    });
    expect(validatePhone({ phone: "123" })).toEqual({
      ok: false,
      errors: { phone: "Enter a valid mobile number" },
    });
  });

  it("accepts only a 6-digit code", () => {
    expect(validateOtp({ code: " 123456 " })).toEqual({ ok: true, data: { code: "123456" } });
    expect(validateOtp({ code: "12a456" })).toEqual({
      ok: false,
      errors: { code: "Enter the 6-digit code" },
    });
  });
});
