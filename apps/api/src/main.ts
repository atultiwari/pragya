import { parseEnv } from "./env.js";
import { buildServer } from "./server.js";

const env = parseEnv(process.env);
const app = await buildServer(env);

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (error: unknown) {
  app.log.fatal({ err: error }, "API failed to start");
  process.exit(1);
}
