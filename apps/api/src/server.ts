import { buildApp } from './app.js';
import { readEnv } from './config/env.js';

const env = readEnv();
const app = await buildApp(env);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    void app
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        app.log.error(error);
        process.exit(1);
      });
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exit(1);
}
