import prisma from '../config/prismaClient';
import { ChargingSession } from '@prisma/client';
import { logError, logInfo, logDebug, logWarn, LogDirection, OcppMessageType, LogLevel } from './logService';

export const createTransaction = async (
  chargePointId: string,
  connectorId: number,
  idTag: string,
  meterStart: number,
  chargerSpotId: string,
  ocppTransactionId: number,
  userId?: string | null,
  reservationId?: string | null
) => {
  try {
    const transaction = await prisma.chargingSession.create({
      data: {
        chargePointId,
        connectorId,
        idTag,
        meterStart,
        transactionIdOcpp: ocppTransactionId,
        startTime: new Date(),
        status: 'Started',
        chargerSpot: {
          connect: {
            id: chargerSpotId,
          },
        },
        user: userId ? {
          connect: {
            id: userId,
          },
        } : undefined,
        reservation: reservationId ? {
          connect: {
            id: reservationId,
          },
        } : undefined,
      },
    });

    logInfo('Transaction created successfully', {
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: {
        transactionId: transaction.id,
        chargePointId,
        connectorId,
        idTag,
        meterStart,
        ocppTransactionId,
        userId,
        reservationId,
      },
    });

    return transaction;
  } catch (error) {
    logError(`Failed to create transaction for ChargePoint: ${chargePointId}`, error, {
      chargePointId,
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: {
        connectorId,
        idTag,
        meterStart,
        ocppTransactionId,
        userId,
        reservationId,
        chargerSpotId,
      },
    });
    return null;
  }
};

export const updateTransaction = async (
  id: string,
  data: {
    meterStop?: number;
    stopTimestamp?: Date;
    stopReason?: string;
    status?: 'Started' | 'InProgress' | 'Completed' | 'Cancelled';
    errorCode?: string;
    currentPower?: number;
    currentEnergy?: number;
  }
) => {
  try {
    let energyConsumedCalculated: number | undefined;

    if (data.meterStop !== undefined) {
      const existingTransaction = await prisma.chargingSession.findUnique({
        where: { id },
        select: { meterStart: true },
      });

      if (existingTransaction?.meterStart !== undefined) {
        energyConsumedCalculated = (data.meterStop - existingTransaction.meterStart) / 1000; // Convert Wh to kWh
        logDebug('Energy consumption calculated', {
          ocppMessageType: OcppMessageType.DATABASE,
          direction: LogDirection.DATABASE,
          payload: {
            meterStart: existingTransaction.meterStart,
            meterStop: data.meterStop,
            energyConsumed: energyConsumedCalculated,
          },
        });
      } else {
        logWarn('Missing meterStart for energy calculation', {
          ocppMessageType: OcppMessageType.DATABASE,
          direction: LogDirection.DATABASE,
          payload: { transactionId: id },
        });
      }
    }

    const transaction = await prisma.chargingSession.update({
      where: { id },
      data: {
        ...data,
        endTime: data.stopTimestamp,
        energyConsumed: energyConsumedCalculated !== undefined ? energyConsumedCalculated : undefined,
        updatedAT: new Date(),
      },
    });

    logInfo('Transaction updated successfully', {
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: {
        transactionId: id,
        ...data,
        energyConsumed: energyConsumedCalculated,
      },
    });

    return transaction;
  } catch (error) {
    logError(`Failed to update transaction: ${id}`, error, {
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: data,
    });
    return null;
  }
};

export const getActiveTransaction = async (chargePointId: string, connectorId: number) => {
  try {
    const transaction = await prisma.chargingSession.findFirst({
      where: {
        chargePointId,
        connectorId,
        status: 'Started',
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    if (transaction) {
      logDebug('Active transaction found', {
        ocppMessageType: OcppMessageType.DATABASE,
        direction: LogDirection.DATABASE,
        payload: {
          transactionId: transaction.id,
          chargePointId,
          connectorId,
        },
      });
    } else {
      logDebug('No active transaction found', {
        ocppMessageType: OcppMessageType.DATABASE,
        direction: LogDirection.DATABASE,
        payload: {
          chargePointId,
          connectorId,
        },
      });
    }

    return transaction;
  } catch (error) {
    logError(`Failed to get active transaction for ChargePoint: ${chargePointId}`, error, {
      chargePointId,
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: { connectorId },
    });
    return null;
  }
};

logInfo('Transaction service initialized.', { ocppMessageType: OcppMessageType.SYSTEM, direction: LogDirection.SERVER }); 