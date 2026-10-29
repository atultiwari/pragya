/** Query parameters that carry one-time credentials (verification/reset tokens, OTPs). */
const SECRET_PARAMS = ["token", "code", "otp"];
/** Path segments that embed a token, e.g. /api/auth/reset-password/<token>. */
const TOKEN_PATH = /^(\/api\/auth\/reset-password\/)[^/?]+/;
const REDACTED = "[REDACTED]";

/** Makes a request URL safe to log. */
export function redactUrl(url: string): string {
  const [rawPath = "", rawQuery] = url.split("?", 2);
  const path = rawPath.replace(TOKEN_PATH, `$1${REDACTED}`);
  if (rawQuery === undefined) return path;
  const params = new URLSearchParams(rawQuery);
  for (const name of SECRET_PARAMS) if (params.has(name)) params.set(name, REDACTED);
  return `${path}?${params.toString()}`;
}

interface LoggableRequest {
  readonly method: string;
  readonly url: string;
  readonly ip?: string;
}

/** pino serializer for Fastify's request logs. */
export const requestSerializer = (request: LoggableRequest) => ({
  method: request.method,
  url: redactUrl(request.url),
  ip: request.ip,
});
