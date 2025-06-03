import { Server as HttpServer } from 'http';
import { URL } from 'url';
import { RPCServer, RPCClient, createRPCError } from 'ocpp-rpc';
import { env } from '../config/env';
import {
  createLogEntry,
  logInfo,
  logError,
  logWarn,
  logDebug,
  LogLevel,
  LogDirection,
  OcppMessageType,
} from '../services/logService';
import { findOrCreateChargePoint, updateChargePointStatus } from '../services/chargePointService';
import { ChargerStatus, BootNotificationParams, StatusNotificationParams } from '../types';
import { Socket } from 'net';

// In-memory map to keep track of connected chargers
export const connectedChargers = new Map<string, RPCClient>();

export const initializeOcppServer = (httpServer: HttpServer) => {
  logInfo('Initializing OCPP Server...', {
    ocppMessageType: OcppMessageType.SYSTEM,
    direction: LogDirection.SERVER,
  });

  const ocppServer = new RPCServer({
    protocols: ['ocpp1.6'],
    strictMode: true,
  });

  // Charger Authentication - Allow initial connection
  ocppServer.auth(async (accept, reject, handshake) => {
    const chargerIdentity = handshake.identity;
    
    logInfo(`New connection attempt from charger: ${chargerIdentity}`, {
      chargePointId: chargerIdentity,
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.INBOUND,
      payload: { identity: chargerIdentity, remoteAddress: handshake.remoteAddress },
    });

    // Accept the initial connection - we'll handle auth in the BootNotification
    accept({ chargerIdentity });
  });

  // Handle Client Connections and OCPP Messages
  ocppServer.on('client', (client: RPCClient) => {
    const chargerIdentity = client.session.chargerIdentity;
    let isAuthenticated = false;

    logInfo(`Charger ${chargerIdentity} connected. Protocol: ${client.protocol}`, {
      chargePointId: chargerIdentity,
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });

    // BootNotification Handler - Now includes authentication
    client.handle('BootNotification', async (message) => {
      const params = message.params as BootNotificationParams;
      
      // Check authentication
      if (!isAuthenticated) {
        // For now, we'll accept all connections
        // In production, you should implement proper authentication here
        isAuthenticated = true;
        connectedChargers.set(chargerIdentity, client);
      }

      logInfo(`Received BootNotification from ${chargerIdentity}`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'BootNotification',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.INBOUND,
        payload: params,
      });

      try {
        const chargePoint = await findOrCreateChargePoint(
          chargerIdentity,
          params.chargePointVendor,
          params.chargePointModel
        );

        if (!chargePoint) {
          logError(`Failed to find or create ChargePoint record for ${chargerIdentity} during BootNotification.`, null, {
            chargePointId: chargerIdentity,
            ocppMethod: 'BootNotification',
            ocppMessageType: OcppMessageType.CALL_ERROR,
            direction: LogDirection.SERVER,
          });
          return {
            status: 'Rejected',
            currentTime: new Date().toISOString(),
            interval: 300,
          };
        }

        await updateChargePointStatus(
          chargerIdentity,
          'Available',
          new Date(),
          new Date(),
          null,
          null,
          null,
          null
        );

        logInfo(`Responded to BootNotification for ${chargerIdentity} with Accepted.`, {
          chargePointId: chargerIdentity,
          ocppMethod: 'BootNotification',
          ocppMessageType: OcppMessageType.CALL_RESULT,
          direction: LogDirection.OUTBOUND,
          payload: { status: 'Accepted', interval: 300 },
        });

        return {
          status: 'Accepted',
          currentTime: new Date().toISOString(),
          interval: 300,
        };
      } catch (error) {
        logError(`Error processing BootNotification for ${chargerIdentity}:`, error, {
          chargePointId: chargerIdentity,
          ocppMethod: 'BootNotification',
          ocppMessageType: OcppMessageType.CALL_ERROR,
          direction: LogDirection.SERVER,
          payload: params,
        });
        throw createRPCError('InternalError', 'Failed to process BootNotification on server.');
      }
    });

    // Heartbeat Handler
    client.handle('Heartbeat', async ({ params }) => {
      logDebug(`Received Heartbeat from ${chargerIdentity}`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'Heartbeat',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.INBOUND,
        payload: params,
      });

      try {
        await updateChargePointStatus(
          chargerIdentity,
          'Available',
          new Date(),
          new Date()
        );

        logDebug(`Responded to Heartbeat for ${chargerIdentity}.`, {
          chargePointId: chargerIdentity,
          ocppMethod: 'Heartbeat',
          ocppMessageType: OcppMessageType.CALL_RESULT,
          direction: LogDirection.OUTBOUND,
        });

        return {
          currentTime: new Date().toISOString(),
        };
      } catch (error) {
        logError(`Error processing Heartbeat for ${chargerIdentity}:`, error, {
          chargePointId: chargerIdentity,
          ocppMethod: 'Heartbeat',
          ocppMessageType: OcppMessageType.CALL_ERROR,
          direction: LogDirection.SERVER,
          payload: params,
        });
        throw createRPCError('InternalError', 'Failed to process Heartbeat on server.');
      }
    });

    // StatusNotification Handler
    client.handle('StatusNotification', async (message) => {
      const params = message.params as StatusNotificationParams;
      logInfo(`Received StatusNotification from ${chargerIdentity}`, {
        chargePointId: chargerIdentity,
        ocppMethod: 'StatusNotification',
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.INBOUND,
        payload: params,
      });

      try {
        await updateChargePointStatus(
          chargerIdentity,
          params.status as ChargerStatus,
          undefined,
          new Date(),
          params.errorCode === 'NoError' ? null : params.errorCode,
          undefined,
          undefined,
          params.connectorId
        );

        logInfo(`Responded to StatusNotification for ${chargerIdentity}.`, {
          chargePointId: chargerIdentity,
          ocppMethod: 'StatusNotification',
          ocppMessageType: OcppMessageType.CALL_RESULT,
          direction: LogDirection.OUTBOUND,
        });
        return {};
      } catch (error) {
        logError(`Error processing StatusNotification for ${chargerIdentity}:`, error, {
          chargePointId: chargerIdentity,
          ocppMethod: 'StatusNotification',
          ocppMessageType: OcppMessageType.CALL_ERROR,
          direction: LogDirection.SERVER,
          payload: params,
        });
        throw createRPCError('InternalError', 'Failed to process StatusNotification on server.');
      }
    });

    // Wildcard handler for unhandled messages
    client.handle(({ method, params }) => {
      logWarn(`Received unhandled OCPP method from ${chargerIdentity}: ${method}`, {
        chargePointId: chargerIdentity,
        ocppMethod: method,
        ocppMessageType: OcppMessageType.CALL,
        direction: LogDirection.INBOUND,
        payload: params,
      });
      throw createRPCError('NotImplemented', `Method ${method} is not implemented on the server.`);
    });

    // Client Connection Lifecycle Events
    client.on('close', async (code, reason) => {
      connectedChargers.delete(chargerIdentity);
      logInfo(`Charger ${chargerIdentity} disconnected. Code: ${code}, Reason: ${reason}`, {
        chargePointId: chargerIdentity,
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
        payload: { code, reason },
      });
      await updateChargePointStatus(chargerIdentity, 'Disconnected', undefined, new Date())
        .catch(err => logError(`Failed to update status to Disconnected for ${chargerIdentity} on close.`, err, {
          chargePointId: chargerIdentity,
          ocppMessageType: OcppMessageType.DATABASE,
          direction: LogDirection.DATABASE,
        }));
    });

    client.on('error', (error) => {
      logError(`OCPP Client ${chargerIdentity} encountered an error:`, error, {
        chargePointId: chargerIdentity,
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.INBOUND,
      });
    });

    client.on('strictValidationFailure', (event) => {
      logWarn(`Strict validation failure for ${chargerIdentity}: ${event.error.message}`, {
        chargePointId: chargerIdentity,
        ocppMethod: event.method,
        ocppMessageType: OcppMessageType.VALIDATION,
        direction: event.outbound ? LogDirection.OUTBOUND : LogDirection.INBOUND,
        payload: { ...event.params, validationError: event.error.message, isCall: event.isCall },
      });
    });
  });

  // General Server Error Handling
  ocppServer.on('error', (error) => {
    logError('OCPP Server internal error:', error, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
  });

  // Integrate with existing HTTP server for WebSocket upgrades
  httpServer.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url || '/', `ws://${request.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/ocpp/')) {
      logInfo(`Attempting to upgrade WebSocket for OCPP path: ${pathname}`, {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      ocppServer.handleUpgrade(request, socket as Socket, head);
    } else {
      logWarn(`Non-OCPP WebSocket upgrade request for path: ${pathname}. Destroying socket.`, {
        ocppMessageType: OcppMessageType.SYSTEM,
        direction: LogDirection.SERVER,
      });
      socket.destroy();
    }
  });

  logInfo('OCPP Server initialized and configured.', {
    ocppMessageType: OcppMessageType.SYSTEM,
    direction: LogDirection.SERVER,
  });

  return { ocppServer, connectedChargers };
};