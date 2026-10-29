import { pino } from "pino";
import { createApp } from "./app.js";
import { parseEnv } from "./env.js";
import { requestSerializer } from "./logging.js";

const env = parseEnv(process.env);
const logger = pino({ level: env.LOG_LEVEL, serializers: { req: requestSerializer } });

try {
  const { server } = await createApp(env, process.env, logger);
  await server.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (error: unknown) {
  logger.fatal({ err: error }, "API failed to start");
  process.exit(1);
}
