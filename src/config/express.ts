import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logInfo, OcppMessageType, LogDirection } from '../services/logService';

export const setupExpressApp = (app: Express) => {
  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Log all requests
  app.use((req, res, next) => {
    logInfo(`HTTP ${req.method} ${req.path}`, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
      payload: {
        method: req.method,
        path: req.path,
        ip: req.ip,
      },
    });
    next();
  });

  // API routes will be added here
  // app.use('/api', apiRouter);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}; 