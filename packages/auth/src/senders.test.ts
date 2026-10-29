import { describe, expect, it, vi } from "vitest";
import { createDevSenders, isE164, isReservedEmail, phoneTempEmail } from "./senders.js";

const logger = () => ({ info: vi.fn(), warn: vi.fn() });

describe("createDevSenders", () => {
  it("logs mail and OTPs instead of sending them", async () => {
    const log = logger();
    const { mailer, sms } = createDevSenders(log, true);
    await mailer.send({ to: "a@example.test", subject: "Verify", text: "link" });
    await sms.sendOtp("+919999999999", "123456");
    expect(log.info).toHaveBeenCalledWith(
      { to: "a@example.test", subject: "Verify", text: "link" },
      "dev mailer: email not sent",
    );
    expect(log.info).toHaveBeenCalledWith(
      { phoneNumber: "+919999999999", code: "123456" },
      "dev sms: OTP not sent",
    );
  });

  it("refuses to start unless explicitly enabled", () => {
    expect(() => createDevSenders(logger(), false)).toThrow(/AUTH_DEV_SENDERS/);
  });
});

describe("isE164", () => {
  it.each([
    ["+919876543210", true],
    ["+14155552671", true],
    ["9876543210", false],
    ["+0123", false],
    ["+91 98765 43210", false],
  ])("%s → %s", (phone, expected) => {
    expect(isE164(phone)).toBe(expected);
  });
});

describe("isReservedEmail", () => {
  it.each([
    ["919876543210@phone.pragya.invalid", true],
    ["someone@anything.invalid", true],
    ["SOMEONE@X.INVALID", true],
    ["asha@example.com", false],
    ["invalid@example.com", false],
  ])("%s → %s", (email, expected) => {
    expect(isReservedEmail(email)).toBe(expected);
  });
});

describe("phoneTempEmail", () => {
  it("derives a non-routable placeholder email from the number", () => {
    expect(phoneTempEmail("+919876543210")).toBe("919876543210@phone.pragya.invalid");
  });
});
