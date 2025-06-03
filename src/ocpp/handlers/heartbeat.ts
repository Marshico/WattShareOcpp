import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';
import { updateChargePointStatus } from '../../services/chargePointService';

export const handleHeartbeat = async (client: any, params: any) => {
  logInfo(`Received Heartbeat from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    await updateChargePointStatus(
      client.id,
      'Available',
      new Date(),
      new Date()
    );

    logInfo(`Responded to Heartbeat for ${client.id}`, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.OUTBOUND,
    });

    return {
      currentTime: new Date().toISOString(),
    };
  } catch (error) {
    logError(`Error processing Heartbeat for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 