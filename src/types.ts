import winston from "winston";

export interface LoggerOptions {
  level?: string;
  format?: winston.Logform.Format;
  transports?: winston.transport[];
}

export interface IReservationData {
  reservation_id: string;
  user_id: string;
  restaurant_id: string;
  date: string;
  time: string;
  party_size: number;
  guest_type: string;
  preferences?: string;
  loyalty_program?: boolean;
  special_requests?: string;
  children?: {
    count: number;
    ages: number[];
  };
  additional_services?: string[];
  confirmation_method?: string;
  payment_method?: string;
  contact_info?: {
    phone?: string;
    email?: string;
  };
  recommendation_request?: string;
}

export type ErrorResult = { success: boolean; error?: string };

export enum ReservationStatus {
  SUCCESS = "SUCCESS",
  NO_TABLE_AVAILABLE = "NO_TABLE_AVAILABLE",
  ERROR = "ERROR",
}

export interface ReservationResponse {
  reservation_id: string;
  status: ReservationStatus;
  message?: string;
}

export const GUEST_STATUS = {
  Regular: "Regular Guest",
  VIP: "VIP Guest",
  Loyalty: "Loyalty Program Member",
} as const;

export type GuestStatus = keyof typeof GUEST_STATUS;
