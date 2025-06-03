import { PrismaClient } from '@prisma/client';
import { ChargerStatus } from '../types';
import { logError, LogDirection, OcppMessageType } from './logService';

const prisma = new PrismaClient();

export const findOrCreateChargePoint = async (
  chargePointId: string,
  vendor: string,
  model: string
) => {
  try {
    const chargePoint = await prisma.chargePoint.upsert({
      where: { chargePointId },
      update: {
        status: 'Available',
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
      },
      create: {
        chargePointId,
        status: 'Available',
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
      },
    });

    return chargePoint;
  } catch (error) {
    logError(`Failed to find or create ChargePoint: ${chargePointId}`, error, {
      chargePointId,
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
    });
    return null;
  }
};

export const updateChargePointStatus = async (
  chargePointId: string,
  status: ChargerStatus,
  lastHeartbeat?: Date,
  lastSeen?: Date,
  errorCode?: string | null,
  currentPower?: number | null,
  currentEnergy?: number | null,
  connectorId?: number | null
) => {
  try {
    const updateData: any = {
      status,
      lastSeen: lastSeen || new Date(),
    };

    if (lastHeartbeat) {
      updateData.lastHeartbeat = lastHeartbeat;
    }

    if (errorCode !== undefined) {
      updateData.errorCode = errorCode;
    }

    if (currentPower !== undefined) {
      updateData.currentPower = currentPower;
    }

    if (currentEnergy !== undefined) {
      updateData.currentEnergy = currentEnergy;
    }

    if (connectorId !== undefined) {
      updateData.connectorId = connectorId;
    }

    const chargePoint = await prisma.chargePoint.update({
      where: { chargePointId },
      data: updateData,
    });

    return chargePoint;
  } catch (error) {
    logError(`Failed to update ChargePoint status: ${chargePointId}`, error, {
      chargePointId,
      ocppMessageType: OcppMessageType.DATABASE,
      direction: LogDirection.DATABASE,
      payload: {
        status,
        lastHeartbeat,
        lastSeen,
        errorCode,
        currentPower,
        currentEnergy,
        connectorId,
      },
    });
    return null;
  }
}; 