import express, { Request, Response, Router, RequestHandler } from 'express';
import http from 'http';
import cors from 'cors';
import { env } from './config/env';
import { logInfo, logError, logWarn, LogDirection, OcppMessageType } from './services/logService';
import { initializeOcppServer, connectedChargers } from './ocpp/ocppServer';
import { RPCClient } from 'ocpp-rpc';
import chargerRoutes from './routes/chargerRoutes';

interface ChargerParams {
  identity: string;
}

interface RemoteStartBody {
  idTag: string;
  connectorId?: number;
}

interface RemoteStopBody {
  transactionId: number;
}

// This function encapsulates all server initialization logic
export async function startHttpAndOcppServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const router = Router();

  // Use CORS middleware (for development, allow all)
  app.use(cors());
  // For production, configure CORS more strictly based on env.NEXTJS_APP_URL
  // app.use(cors({
  //   origin: env.NEXTJS_APP_URL,
  //   methods: ['GET', 'POST'],
  //   allowedHeaders: ['Content-Type', 'Authorization'],
  // }));

  // Enable JSON body parsing for Express app
  app.use(express.json());

  // Initialize the OCPP Server and integrate with the HTTP server
  const { ocppServer } = initializeOcppServer(httpServer);

  // --- Express API Endpoints ---

  // Health Check
  router.get('/', (req, res) => {
    res.status(200).send('OCPP Central System Backend is running!');
    logInfo('API: Health check accessed.', {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
      payload: { path: req.path },
    });
  });

  // API endpoint to get list of currently connected chargers
  router.get('/chargers', (req, res) => {
    const chargerList = Array.from(connectedChargers.keys()).map((identity) => ({
      identity: identity,
      connected: true,
    }));
    logInfo('API: Fetched connected chargers list.', {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
      payload: { count: chargerList.length },
    });
    res.json({ chargers: chargerList });
  });

  // API endpoint to send a RemoteStartTransaction command
  const remoteStartHandler: RequestHandler<ChargerParams, any, RemoteStartBody> = async (req, res) => {
    const chargerIdentity = req.params.identity;
    const { idTag, connectorId = 1 } = req.body;

    const client: RPCClient | undefined = connectedChargers.get(chargerIdentity);

    if (!client) {
      logWarn(`API: RemoteStartTransaction failed. Charger ${chargerIdentity} not connected.`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStartTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: req.body,
      });
      res.status(404).json({ error: 'Charger not connected or found.' });
      return;
    }

    if (!idTag) {
      logWarn(`API: RemoteStartTransaction failed for ${chargerIdentity}. Missing idTag.`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStartTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: req.body,
      });
      res.status(400).json({ error: 'idTag is required for RemoteStartTransaction.' });
      return;
    }

    try {
      logInfo(`API: Sending RemoteStartTransaction to ${chargerIdentity} for idTag: ${idTag}`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStartTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: { connectorId, idTag },
      });

      const ocppResponse = await client.call('RemoteStartTransaction', {
        connectorId: parseInt(connectorId.toString()),
        idTag: idTag,
      });

      logInfo(`API: RemoteStartTransaction response from ${chargerIdentity}:`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStartTransaction',
        ocppMessageType: OcppMessageType.CALL_RESULT,
        direction: LogDirection.INBOUND,
        payload: ocppResponse,
      });

      res.json({ success: true, ocppResponse: ocppResponse });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`API: Error sending RemoteStartTransaction to ${chargerIdentity}:`, error, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStartTransaction',
        ocppMessageType: OcppMessageType.CALL_ERROR,
        direction: LogDirection.OUTBOUND,
        payload: { requestBody: req.body, errorMessage },
      });
      res.status(500).json({ error: 'Failed to send command to charger', details: errorMessage });
    }
  };

  // API endpoint to send a RemoteStopTransaction command
  const remoteStopHandler: RequestHandler<ChargerParams, any, RemoteStopBody> = async (req, res) => {
    const chargerIdentity = req.params.identity;
    const { transactionId } = req.body;

    const client: RPCClient | undefined = connectedChargers.get(chargerIdentity);

    if (!client) {
      logWarn(`API: RemoteStopTransaction failed. Charger ${chargerIdentity} not connected.`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStopTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: req.body,
      });
      res.status(404).json({ error: 'Charger not connected or found.' });
      return;
    }

    if (!transactionId) {
      logWarn(`API: RemoteStopTransaction failed for ${chargerIdentity}. Missing transactionId.`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStopTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: req.body,
      });
      res.status(400).json({ error: 'transactionId is required for RemoteStopTransaction.' });
      return;
    }

    try {
      logInfo(`API: Sending RemoteStopTransaction to ${chargerIdentity} for transactionId: ${transactionId}`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStopTransaction',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.OUTBOUND,
        payload: { transactionId },
      });

      const ocppResponse = await client.call('RemoteStopTransaction', {
        transactionId: parseInt(transactionId.toString()),
      });

      logInfo(`API: RemoteStopTransaction response from ${chargerIdentity}:`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStopTransaction',
        ocppMessageType: OcppMessageType.CALL_RESULT,
        direction: LogDirection.INBOUND,
        payload: ocppResponse,
      });

      res.json({ success: true, ocppResponse: ocppResponse });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`API: Error sending RemoteStopTransaction to ${chargerIdentity}:`, error, {
        chargePointId: chargerIdentity,
        ocppMethod: 'RemoteStopTransaction',
        ocppMessageType: OcppMessageType.CALL_ERROR,
        direction: LogDirection.OUTBOUND,
        payload: { requestBody: req.body, errorMessage },
      });
      res.status(500).json({ error: 'Failed to send command to charger', details: errorMessage });
    }
  };

  // Mount routes
  router.post('/chargers/:identity/remote-start', remoteStartHandler);
  router.post('/chargers/:identity/remote-stop', remoteStopHandler);

  // Mount charger routes
  app.use('/api', router);
  app.use('/api/chargers', chargerRoutes);

  // Start the HTTP server
  httpServer.listen(env.PORT, () => {
    logInfo(`OCPP Central System Backend listening on port ${env.PORT}`, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
      payload: { port: env.PORT },
    });
    logInfo(`Connect chargers to ws://localhost:${env.PORT}/ocpp/<chargerIdentity> (for local testing)`, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
    logInfo(`API endpoints available at http://localhost:${env.PORT}/api/`, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
  }).on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logError(`Port ${env.PORT} is already in use. Please try the following:`, error, {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      logInfo('1. Kill the process using the port:', {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      logInfo('   Windows: netstat -ano | findstr :3000', {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      logInfo('   Then: taskkill /F /PID <PID>', {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      logInfo('2. Or use a different port by setting the PORT environment variable', {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
    } else {
      logError('Failed to start server:', error, {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
    }
  });

  // Set up graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logInfo(`Received ${signal}. Shutting down HTTP and OCPP server gracefully.`, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            logError('Error closing HTTP server:', err, {
              ocppMessageType: OcppMessageType.SYSTEM,
              direction: LogDirection.SERVER,
            });
            return reject(err);
          }
          resolve();
        });
      });

      await ocppServer.close({ awaitPending: true, force: false });

      logInfo('HTTP and OCPP server closed gracefully.', {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      process.exit(0);
    } catch (error) {
      logError('Error during graceful shutdown:', error, {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Return the http server instance and other essentials for index.ts to manage
  return { httpServer, ocppServer, connectedChargers };
} 