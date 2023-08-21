import amqp, { Message } from "amqplib";
import { Logger } from "./logger";
import { ErrorResult, IReservationData, LoggerOptions, ReservationResponse } from "./types";
import winston from "winston";

export class RabbitMQConnection {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private logger: Logger;
  port = process.env.PORT_RABBITMQ;
  user = process.env.RABBITMQ_USER;
  pass = process.env.RABBITMQ_PASS;
  amqpUrl = `amqp://${this.user}:${this.pass}@localhost:${this.port}`;
  private static instance: RabbitMQConnection | null = null;

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

  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      this.connection = await amqp.connect(this.amqpUrl);
      this.channel = await this.connection.createChannel();
      this.logInfo("Connected to RabbitMQ");
      return { success: true };
    } catch (error) {
      return this.handleAndLogError("Error connecting to RabbitMQ", error);
    }
  }

  public async subscribeToQueue(queueName: string, callback: (message: IReservationData) => void): Promise<void> {
    await this.ensureConnectedChannel();

    try {
      await this.channel!.assertQueue(queueName, { durable: true });
      this.channel!.consume(queueName, async (msg: Message | null) => {
        if (msg !== null) {
          await this.processQueueMessage(msg, callback);
        }
      });
      this.logInfo(`Subscribed to queue: ${queueName}`);
    } catch (error) {
      this.handleError(`Error subscribing to queue ${queueName}`, error);
    }
  }

  public async sendMessage(queueName: string, message: ReservationResponse): Promise<ErrorResult> {
    await this.ensureConnectedChannel();

    try {
      await this.channel!.assertQueue(queueName, { durable: true });
      this.sendToQueue(queueName, message);
      return { success: true };
    } catch (error) {
      return await this.handleAndLogError("Error sending message:", error);
    }
  }

  public static getInstance(): RabbitMQConnection {
    if (!this.instance) {
      this.instance = new RabbitMQConnection();
    }
    return this.instance;
  }

  public async sendToQueue(queueName: string, message: any): Promise<void> {
    try {
      await this.channel?.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
    } catch (error) {
      this.logError(`Error sending message to queue: ${message}`);
    }
  }

  public getChannel(): amqp.Channel | null {
    return this.channel !== null ? this.channel : null;
  }

  public async closeConnection(): Promise<ErrorResult> {
    if (this.connection) {
      try {
        this.logInfo("Closing connection to RabbitMQ...");
        await this.connection.close();
        this.logInfo("Connection to RabbitMQ closed successfully");
        this.connection = null;
        this.channel = null;
        return { success: true };
      } catch (error) {
        return await this.handleAndLogError("Error closing connection", error);
      }
    } else {
      this.logWarn("No active connection to close.");
      return await this.handleAndLogError("No active connection.", new Error("No active connection."));
    }
  }

  private async processQueueMessage(msg: Message, callback: (message: IReservationData) => void): Promise<void> {
    try {
      const message = JSON.parse(msg.content.toString()) as IReservationData;
      if (this.isValidMessage(message)) {
        callback(message);
        this.channel!.ack(msg);
        this.sendSuccessMessage("VIP table successfully reserved.");
      } else {
        this.logWarn(`Received invalid message: ${JSON.stringify(message)}`);
        this.channel!.nack(msg);
      }
    } catch (error) {
      await this.handleErrorAndNackQueue("Error processing message:", error, msg);
    }
  }

  private async ensureConnectedChannel(): Promise<void> {
    if (!this.connection || !this.channel) {
      await this.connect();
    }
  }

  private sendSuccessMessage(message: string): void {
    const successResult = { status: "SUCCESS", message };
    this.sendToQueue("success_results_queue", successResult);
  }

  private isValidMessage(message: any): boolean {
    const requiredFields: (keyof IReservationData)[] = [
      "reservation_id",
      "user_id",
      "restaurant_id",
      "date",
      "time",
      "party_size",
      "guest_type",
    ];
    return requiredFields.every(field => typeof message[field] !== "undefined");
  }

  private async handleAndLogError(message: string, error: Error): Promise<ErrorResult> {
    const errorMessage = `${message}: ${error.message}`;
    this.logger.error(errorMessage);
    return { success: false, error: errorMessage };
  }

  private async handleErrorAndNackQueue(message: string, error: Error, msg: Message): Promise<ErrorResult> {
    this.handleError(message, error);
    this.channel!.nack(msg);
    return { success: false };
  }

  private handleError(message: string, error: Error): void {
    const errorMessage = `${message}: ${error.message}`;
    this.logger.error(errorMessage);
  }

  private logInfo(message: string): void {
    this.logger.info(`[RabbitMQ] ${message}`);
  }

  private logWarn(message: string): void {
    this.logger.warn(`[RabbitMQ] ${message}`);
  }

  private logError(message: string): void {
    this.logger.error(`[RabbitMQ] ${message}`);
  }
}
