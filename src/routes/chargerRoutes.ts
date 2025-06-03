import express, { Request, Response, Router, RequestHandler } from 'express';
import { logInfo, logWarn, logError, LogDirection, OcppMessageType } from '../services/logService';
import { connectedChargers } from '../ocpp/ocppServer';
import { RPCClient } from 'ocpp-rpc';

const router: Router = express.Router();

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

// Get list of connected chargers
const getChargers: RequestHandler = (req, res) => {
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
};

// Remote start transaction
const remoteStartTransaction: RequestHandler<ChargerParams, {}, RemoteStartBody> = async (req, res) => {
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
      connectorId: connectorId.toString(),
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
  } catch (error: any) {
    logError(`API: Error sending RemoteStartTransaction to ${chargerIdentity}:`, error, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStartTransaction',
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.OUTBOUND,
      payload: { requestBody: req.body, errorMessage: error.message },
    });
    res.status(500).json({ error: 'Failed to send command to charger', details: error.message });
  }
};

// Remote stop transaction
const remoteStopTransaction: RequestHandler<ChargerParams, {}, RemoteStopBody> = async (req, res) => {
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
      transactionId: transactionId.toString(),
    });

    logInfo(`API: RemoteStopTransaction response from ${chargerIdentity}:`, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.INBOUND,
      payload: ocppResponse,
    });

    res.json({ success: true, ocppResponse: ocppResponse });
  } catch (error: any) {
    logError(`API: Error sending RemoteStopTransaction to ${chargerIdentity}:`, error, {
      chargePointId: chargerIdentity,
      ocppMethod: 'RemoteStopTransaction',
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.OUTBOUND,
      payload: { requestBody: req.body, errorMessage: error.message },
    });
    res.status(500).json({ error: 'Failed to send command to charger', details: error.message });
  }
};

router.get('/', getChargers);
router.post('/:identity/remote-start', remoteStartTransaction);
router.post('/:identity/remote-stop', remoteStopTransaction);

export default router; 