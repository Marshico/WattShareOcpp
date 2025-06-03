import { RPCServer, RPCClient, createRPCError } from 'ocpp-rpc';
import { logInfo, logError, logWarn, OcppMessageType, LogDirection } from '../services/logService';
import { handleBootNotification } from './handlers/bootNotification';
import { handleStartTransaction } from './handlers/startTransaction';
import { handleStopTransaction } from './handlers/stopTransaction';
import { handleMeterValues } from './handlers/meterValues';
import { handleHeartbeat } from './handlers/heartbeat';
import { handleStatusNotification } from './handlers/statusNotification';
import { env } from '../config/env';

export const connectedChargers = new Map<string, RPCClient>();

export const initializeOcppServer = (httpServer: any) => {
  const ocppServer = new RPCServer({
    protocols: ['ocpp1.6'],
    strictMode: true,
  });

  // MODIFIED AUTHENTICATION LOGIC (Bypass for Development)
  ocppServer.auth(async (accept, reject, handshake) => {
    const chargerIdentity = handshake.identity;
    const chargerPassword = handshake.password ? handshake.password.toString('utf8') : null;
    
    logInfo(`Authentication attempt from charger: ${chargerIdentity}`, {
      chargePointId: chargerIdentity,
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.INBOUND,
      payload: { identity: chargerIdentity, remoteAddress: handshake.remoteAddress, path: handshake.endpoint },
    });

    // Authentication Logic:
    // IF CHARGER_SECRET is NOT set in .env (i.e., env.CHARGER_SECRET is falsy),
    //   OR IF chargerIdentity exists AND the provided password matches the secret.
    // This allows bypass for development when CHARGER_SECRET is empty/undefined.
    if (!env.CHARGER_SECRET || (chargerIdentity && chargerPassword === env.CHARGER_SECRET)) {
      logInfo(`Charger ${chargerIdentity} authenticated successfully. (Secret required: ${!!env.CHARGER_SECRET})`, {
      chargePointId: chargerIdentity,
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
      // Attach chargerIdentity to session for later access
      accept({ chargerIdentity: chargerIdentity });
    } else {
      // Authentication failed because CHARGER_SECRET is set but credentials didn't match.
      logWarn(`Authentication failed for charger: ${chargerIdentity}. Credentials mismatch or missing identity.`, {
        chargePointId: chargerIdentity,
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
        payload: { providedPassword: chargerPassword, expectedSecretSet: !!env.CHARGER_SECRET },
      });
      reject(401, 'Unauthorized');
    }
  });

  // Log when a charger connects
  ocppServer.on('client', (client: RPCClient) => {
    const chargerIdentity = client.session.chargerIdentity;
    if (chargerIdentity) {
      connectedChargers.set(chargerIdentity, client);
      logInfo(`Charger connected: ${chargerIdentity}`, {
        chargePointId: chargerIdentity,
        ocppMessageType: OcppMessageType.SYSTEM,
          direction: LogDirection.SERVER,
      });
    }
  });

  // Log when a charger disconnects
  ocppServer.on('close', (client: RPCClient) => {
    const chargerIdentity = client.session.chargerIdentity;
    if (chargerIdentity) {
      connectedChargers.delete(chargerIdentity);
      logInfo(`Charger disconnected: ${chargerIdentity}`, {
        chargePointId: chargerIdentity,
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
    }
  });

  // Register OCPP message handlers
  ocppServer.on('BootNotification', handleBootNotification);
  ocppServer.on('StartTransaction', handleStartTransaction);
  ocppServer.on('StopTransaction', handleStopTransaction);
  ocppServer.on('MeterValues', handleMeterValues);
  ocppServer.on('Heartbeat', handleHeartbeat);
  ocppServer.on('StatusNotification', handleStatusNotification);

  // Handle errors
  ocppServer.on('error', (error) => {
    logError('OCPP server error', error, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
  });

  // Integrate with HTTP server
  httpServer.on('upgrade', (request: any, socket: any, head: any) => {
    const pathname = new URL(request.url || '/', `ws://${request.headers.host}`).pathname;
    if (pathname.startsWith('/ocpp/')) {
      ocppServer.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  logInfo('OCPP server initialized', {
    ocppMessageType: OcppMessageType.SYSTEM,
    direction: LogDirection.SERVER,
  });

  return { ocppServer };
};