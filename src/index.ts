import dotenv from "dotenv";
import { TaskProcessor } from "./taskProcessor";
dotenv.config();

const taskProcessor = new TaskProcessor();

async function main() {
  try {
    await taskProcessor.initialize();
    taskProcessor.startProcessing();
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  }
}

main();
