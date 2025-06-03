// src/types/index.d.ts

// Extend the RPCClient type to include session
declare module 'ocpp-rpc' {
  interface RPCClientSession {
    chargerIdentity: string;
  }

  interface RPCClient {
    session: RPCClientSession;
    protocol: string;
  }
}

// OCPP Message Parameter Types
export interface BootNotificationParams {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterType?: string;
  meterSerialNumber?: string;
}

export interface StatusNotificationParams {
  connectorId: number;
  errorCode: string;
  status: string;
  info?: string;
  timestamp?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

// Common API response type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

// OCPP Command Response types
export interface RemoteStartTransactionResponse {
  status: 'Accepted' | 'Rejected';
}

export interface RemoteStopTransactionResponse {
  status: 'Accepted' | 'Rejected';
}

// Charger Status types
export type ChargerStatus = 
  | 'Available'
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEV'
  | 'SuspendedEVSE'
  | 'Finishing'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted'
  | 'Connected'
  | 'Disconnected';

// Charger Connection Status
export interface ChargerConnectionStatus {
  identity: string;
  connected: boolean;
  lastSeen?: Date;
  status?: ChargerStatus;
  currentPower?: number;
  currentEnergy?: number;
  errorCode?: string;
} 