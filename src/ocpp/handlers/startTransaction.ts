import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';
import { createTransaction } from '../../services/transactionService';

export const handleStartTransaction = async (client: any, params: any) => {
  const { idTag, meterStart, connectorId } = params;
  
  logInfo(`Received StartTransaction from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    const transaction = await createTransaction(
      client.id,
      connectorId,
      idTag,
      meterStart,
      client.id, // Using client.id as chargerSpotId for now
      params.transactionId,
      null, // userId
      null  // reservationId
    );

    if (!transaction) {
      logError(`Failed to create transaction for ${client.id}`, null, {
        chargePointId: client.id,
        ocppMessageType: OcppMessageType.CALL_ERROR,
        direction: LogDirection.SERVER,
      });
      return {
        idTagInfo: { status: 'Rejected' },
        transactionId: null,
      };
    }

    logInfo(`Created transaction for ${client.id}`, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_RESULT,
      direction: LogDirection.OUTBOUND,
      payload: { transactionId: transaction.id },
    });

    return {
      idTagInfo: { status: 'Accepted' },
      transactionId: transaction.id,
    };
  } catch (error) {
    logError(`Error processing StartTransaction for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 