import { logInfo, logError, OcppMessageType, LogDirection } from '../../services/logService';
import { updateTransaction } from '../../services/transactionService';

interface MeterValue {
  measurand: string;
  value: string;
}

export const handleMeterValues = async (client: any, params: any) => {
  const { connectorId, transactionId, meterValue } = params;
  
  logInfo(`Received MeterValues from ${client.id}`, {
    chargePointId: client.id,
    ocppMessageType: OcppMessageType.CALL,
    direction: LogDirection.INBOUND,
    payload: params,
  });

  try {
    if (transactionId) {
      const currentPower = meterValue?.find((mv: MeterValue) => mv.measurand === 'Power.Active.Import')?.value;
      const currentEnergy = meterValue?.find((mv: MeterValue) => mv.measurand === 'Energy.Active.Import.Register')?.value;

      await updateTransaction(transactionId, {
        currentPower: currentPower ? parseFloat(currentPower) : undefined,
        currentEnergy: currentEnergy ? parseFloat(currentEnergy) : undefined,
      });
    }

    return {};
  } catch (error) {
    logError(`Error processing MeterValues for ${client.id}:`, error, {
      chargePointId: client.id,
      ocppMessageType: OcppMessageType.CALL_ERROR,
      direction: LogDirection.SERVER,
      payload: params,
    });
    throw error;
  }
}; 