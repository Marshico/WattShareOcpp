import express, { Request, Response, RequestHandler } from 'express';
import http from 'http';
import cors from 'cors';
import { env } from './config/env';
import { logInfo, logError, logWarn, LogDirection, OcppMessageType } from './services/logService';
import { initializeOcppServer, connectedChargers } from './ocpp/ocppServer';
import { RPCClient } from 'ocpp-rpc';
import { ApiResponse, RemoteStartTransactionResponse, RemoteStopTransactionResponse } from './types';

export const app = express();
const httpServer = http.createServer(app);

// Use CORS middleware
app.use(cors());

// Enable JSON body parsing
app.use(express.json());

// Initialize the OCPP Server
const { ocppServer } = initializeOcppServer(httpServer);

// Health Check
app.get('/', (req, res) => {
  res.status(200).send('OCPP Central System Backend is running!');
  logInfo('Health check accessed.', {
    ocppMessageType: OcppMessageType.SYSTEM,
    direction: LogDirection.SERVER,
    payload: { path: req.path },
  });
});

// API endpoint to get list of currently connected chargers
app.get('/api/chargers', (req, res) => {
  const chargerList = Array.from(connectedChargers.keys()).map((identity) => ({
    identity,
    connected: true,
  }));

  const response: ApiResponse = {
    success: true,
    data: { chargers: chargerList },
  };

  logInfo('API: Fetched connected chargers list.', {
    ocppMessageType: OcppMessageType.SYSTEM,
    direction: LogDirection.SERVER,
    payload: { count: chargerList.length },
  });

  res.json(response);
});

// API endpoint to send a RemoteStartTransaction command
app.post('/api/chargers/:identity/remote-start', (async (req: Request, res: Response) => {
  const chargerIdentity = req.params.identity;
  const { idTag, connectorId = 1 } = req.body;

  const client: RPCClient | undefined = connectedChargers.get(chargerIdentity);

  if (!client) {
    const response: ApiResponse = {
      success: false,
      error: 'Charger not connected or found.',
    };
    logWarn(`API: RemoteStartTransaction failed. Charger ${chargerIdentity} not connected.`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStartTransaction',
      ocppMessageType: OcppMessageType.CALL,
      direction: LogDirection.OUTBOUND,
      payload: req.body,
    });
    return res.status(404).json(response);
  }

  if (!idTag) {
    const response: ApiResponse = {
      success: false,
      error: 'idTag is required for RemoteStartTransaction.',
    };
    logWarn(`API: RemoteStartTransaction failed for ${chargerIdentity}. Missing idTag.`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStartTransaction',
      ocppMessageType: OcppMessageType.CALL,
      direction: LogDirection.OUTBOUND,
      payload: req.body,
    });
    return res.status(400).json(response);
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
      connectorId: parseInt(connectorId),
      idTag,
    });

    logInfo(`API: RemoteStartTransaction response from ${chargerIdentity}:`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStartTransaction',
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.INBOUND,
      payload: ocppResponse,
    });

    const response: ApiResponse = {
      success: true,
      data: { ocppResponse },
    };
    res.json(response);
  } catch (error: any) {
    logError(`API: Error sending RemoteStartTransaction to ${chargerIdentity}:`, error, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStartTransaction',
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.OUTBOUND,
      payload: { requestBody: req.body, errorMessage: error.message },
    });
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send command to charger',
      details: error.message,
    };
    res.status(500).json(response);
  }
}) as RequestHandler);

// API endpoint to send a RemoteStopTransaction command
app.post('/api/chargers/:identity/remote-stop', (async (req: Request, res: Response) => {
  const chargerIdentity = req.params.identity;
  const { transactionId } = req.body;

  const client: RPCClient | undefined = connectedChargers.get(chargerIdentity);

  if (!client) {
    const response: ApiResponse = {
      success: false,
      error: 'Charger not connected or found.',
    };
    logWarn(`API: RemoteStopTransaction failed. Charger ${chargerIdentity} not connected.`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL,
      direction: LogDirection.OUTBOUND,
      payload: req.body,
    });
    return res.status(404).json(response);
  }

  if (!transactionId) {
    const response: ApiResponse = {
      success: false,
      error: 'transactionId is required for RemoteStopTransaction.',
    };
    logWarn(`API: RemoteStopTransaction failed for ${chargerIdentity}. Missing transactionId.`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL,
      direction: LogDirection.OUTBOUND,
      payload: req.body,
    });
    return res.status(400).json(response);
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
      transactionId: parseInt(transactionId),
    });

    logInfo(`API: RemoteStopTransaction response from ${chargerIdentity}:`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.INBOUND,
      payload: ocppResponse,
    });

    const response: ApiResponse = {
      success: true,
      data: { ocppResponse },
    };
    res.json(response);
  } catch (error: any) {
    logError(`API: Error sending RemoteStopTransaction to ${chargerIdentity}:`, error, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.OUTBOUND,
      payload: { requestBody: req.body, errorMessage: error.message },
    });
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send command to charger',
      details: error.message,
    };
    res.status(500).json(response);
  }
}) as RequestHandler);

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
  process.exit(1);
});

// Graceful Shutdown
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