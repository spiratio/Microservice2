import { RabbitMQConnection } from "./rabbitMQClient";
import * as amqp from "amqplib";
import { Logger } from "./logger";
import ReservationProcessor from "./reservationProcessor";
import { IReservationData, LoggerOptions, ReservationResponse } from "./types";
import winston from "winston";

export class TaskProcessor {
  private logger: Logger;
  private rabbitMQConnection: RabbitMQConnection;
  private rabbitMQChannel: amqp.Channel | null = null;
  private reservationProcessor: ReservationProcessor;
  private readonly regularQueueName = "regular_guest_processing_queue";
  private readonly vipQueueName = "vip_guest_processing_queue";
  private readonly loyaltyQueueName = "loyalty_member_processing_queue";
  private readonly bookingQueueName = "booking_processing_results";

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
    this.reservationProcessor = new ReservationProcessor();
    this.rabbitMQConnection = RabbitMQConnection.getInstance();
  }

  public async initialize() {
    try {
      const result = await this.rabbitMQConnection.connect();
      if (result.success) {
        this.rabbitMQChannel = this.rabbitMQConnection.getChannel() as amqp.Channel;
        this.logInfo("Connected to RabbitMQ and obtained channel");
      } else {
        this.logError(`Failed to connect to RabbitMQ: ${result.error}`);
      }
    } catch (error) {
      this.logError(`Error during RabbitMQ connection: ${error.message}`);
    }
  }

  private async handleTask(queueName: string, reservationData: IReservationData) {
    const reservation_id = reservationData.reservation_id;
    this.logInfo(`Received task from queue ${queueName}: ${reservation_id}`);
    try {
      const reservationResult = await this.reservationProcessor.processReservation(reservationData);
      await this.sendResultAsync(reservationResult, reservation_id);
    } catch (error) {
      this.logError(`Error processing task for reservation ID: ${reservation_id}: ${error.message}`);
    }
  }

  private async sendResultAsync(result: ReservationResponse, reservation_id: string) {
    try {
      if (!this.rabbitMQChannel) {
        this.logError("No active channel.");
        return;
      }
      await this.rabbitMQChannel.assertQueue(this.bookingQueueName, { durable: true });
      await this.rabbitMQChannel.sendToQueue(this.bookingQueueName, Buffer.from(JSON.stringify(result)), {
        persistent: true,
      });

      this.logInfo(`Result sent to queue: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logError(`Error sending result to queue: ${error}`);
    }
  }

  public startProcessing() {
    this.rabbitMQConnection.subscribeToQueue(this.regularQueueName, async message => {
      await this.handleTask(this.regularQueueName, message as IReservationData);
    });

    this.rabbitMQConnection.subscribeToQueue(this.vipQueueName, async message => {
      await this.handleTask(this.vipQueueName, message as IReservationData);
    });

    this.rabbitMQConnection.subscribeToQueue(this.loyaltyQueueName, async message => {
      await this.handleTask(this.loyaltyQueueName, message as IReservationData);
    });
  }

  private logInfo(message: string): void {
    this.logger.info(`[TaskProcessor] ${message}`);
  }

  private logError(message: string): void {
    this.logger.error(`[TaskProcessor] ${message}`);
  }
}
