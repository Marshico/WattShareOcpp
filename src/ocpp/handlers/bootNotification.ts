import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';
import { findOrCreateChargePoint, updateChargePointStatus } from '../../services/chargePointService';

export const handleBootNotification = async (client: any, params: any) => {
  const { chargePointVendor, chargePointModel } = params;
  
  logInfo(`Received BootNotification from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    const chargePoint = await findOrCreateChargePoint(
      client.id,
      chargePointVendor,
      chargePointModel
    );

    if (!chargePoint) {
      logError(`Failed to find or create ChargePoint record for ${client.id}`, null, {
        chargePointId: client.id,
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
      client.id,
      'Available',
      new Date(),
      new Date()
    );

    logInfo(`Responded to BootNotification for ${client.id}`, {
      chargePointId: client.id,
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
    logError(`Error processing BootNotification for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 