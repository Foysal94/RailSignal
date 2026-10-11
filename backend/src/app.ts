import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { healthRoutes } from './routes/health.js';

export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(healthRoutes);

  return app;
}
