import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';
import { updateTransaction } from '../../services/transactionService';

export const handleStopTransaction = async (client: any, params: any) => {
  const { meterStop, transactionId, reason } = params;
  
  logInfo(`Received StopTransaction from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    const transaction = await updateTransaction(transactionId, {
      meterStop,
      stopTimestamp: new Date(),
      stopReason: reason,
      status: 'Completed'
    });

    if (!transaction) {
      logError(`Failed to update transaction ${transactionId}`, null, {
        chargePointId: client.id,
        ocppMessageType: OcppMessageType.CALL_ERROR,
        direction: LogDirection.SERVER,
      });
      return { idTagInfo: { status: 'Rejected' } };
    }

    logInfo(`Updated transaction ${transactionId}`, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.OUTBOUND,
      payload: { transactionId },
    });

    return { idTagInfo: { status: 'Accepted' } };
  } catch (error) {
    logError(`Error processing StopTransaction for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 