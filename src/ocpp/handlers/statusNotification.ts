import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';

export const handleStatusNotification = async (client: any, params: any) => {
  const { connectorId, errorCode, status } = params;
  
  logInfo(`Received StatusNotification from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    // TODO: Update charge point status in database
    return {};
  } catch (error) {
    logError(`Error processing StatusNotification for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 