export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Outbound email (verification, password reset). Production uses a provider such as Resend or SES. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Outbound SMS one-time passwords. Production uses a provider such as MSG91. */
export interface SmsSender {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

export interface SenderLogger {
  info(details: object, message: string): void;
  warn(details: object, message: string): void;
}

/**
 * Development senders that write messages to the log instead of delivering them, so
 * verification links and OTPs can be read locally. Because those logs then hold live
 * credentials, they start only when AUTH_DEV_SENDERS=true was set explicitly.
 */
export function createDevSenders(
  logger: SenderLogger,
  enabled: boolean,
): { readonly mailer: Mailer; readonly sms: SmsSender } {
  if (!enabled) {
    throw new Error(
      "No mail/SMS provider configured; set AUTH_DEV_SENDERS=true for local development",
    );
  }
  return {
    mailer: {
      send: async (message) => logger.info({ ...message }, "dev mailer: email not sent"),
    },
    sms: {
      sendOtp: async (phoneNumber, code) =>
        logger.info({ phoneNumber, code }, "dev sms: OTP not sent"),
    },
  };
}

const E164 = /^\+[1-9]\d{6,14}$/;

export const isE164 = (phoneNumber: string): boolean => E164.test(phoneNumber);

/** `.invalid` addresses (RFC 2606) are reserved for phone-only accounts and never accepted from users. */
export const isReservedEmail = (email: string): boolean =>
  email.trim().toLowerCase().endsWith(".invalid");

/** Phone-only sign-ups still need a unique email column; this one can never receive mail. */
export const phoneTempEmail = (phoneNumber: string): string =>
  `${phoneNumber.replace(/\D/g, "")}@phone.pragya.invalid`;
