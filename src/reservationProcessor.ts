import { Logger } from "./logger";
import winston from "winston";
import { GUEST_STATUS, IReservationData, LoggerOptions, ReservationResponse, ReservationStatus } from "./types";

class ReservationProcessor {
  private static readonly REGULAR_CHANCE_THRESHOLD = 0.5;
  private static readonly LOYALTY_CHANCE_THRESHOLD = 0.3;
  private logger: Logger;

  constructor() {
    const loggerOptions: LoggerOptions = {
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
      ),
    };

    this.logger = new Logger(loggerOptions);
  }

  processReservation(reservationData: IReservationData): ReservationResponse {
    let status: ReservationStatus;
    let message: string | undefined;
    const reservation_id = reservationData.reservation_id;

    this.logInfo(`Processing reservation for reservation ID: ${reservation_id}`);

    try {
      switch (reservationData.guest_type) {
        case GUEST_STATUS.VIP:
          status = ReservationStatus.SUCCESS;
          message = "VIP table successfully reserved.";
          break;
        case GUEST_STATUS.Regular:
          const randomChance = Math.random();
          if (randomChance < ReservationProcessor.REGULAR_CHANCE_THRESHOLD) {
            status = ReservationStatus.NO_TABLE_AVAILABLE;
            message = "No table available for regular guest.";
          } else {
            status = ReservationStatus.SUCCESS;
            message = "Regular table successfully reserved.";
          }
          break;
        case GUEST_STATUS.Loyalty:
          const loyaltyChance = Math.random();
          if (loyaltyChance < ReservationProcessor.LOYALTY_CHANCE_THRESHOLD) {
            status = ReservationStatus.NO_TABLE_AVAILABLE;
            message = "No table available for loyalty member.";
          } else {
            status = ReservationStatus.SUCCESS;
            message = "Loyalty member table successfully reserved.";
          }
          break;
        default:
          status = ReservationStatus.ERROR;
          message = "Invalid guest type.";
          break;
      }

      this.logInfo(`Reservation processed successfully for reservation ID: ${reservation_id}`);

      return {
        status,
        message,
        reservation_id,
      };
    } catch (error) {
      this.logError(`Error processing reservation for reservation ID: ${reservation_id} ${error}`);
      return {
        status: ReservationStatus.ERROR,
        message: "An error occurred while processing the reservation.",
        reservation_id,
      };
    }
  }

  private logInfo(message: string): void {
    this.logger.info(`[ReservationProcessor] ${message}`);
  }

  private logError(message: string): void {
    this.logger.error(`[ReservationProcessor] ${message}`);
  }
}

export default ReservationProcessor;
