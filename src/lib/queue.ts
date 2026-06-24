import fs from "fs";
import path from "path";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const QUEUE_FILE_PATH = path.join(process.cwd(), "scratch", "sqs-fallback-queue.json");

// Ensure scratch directory exists
const scratchDir = path.dirname(QUEUE_FILE_PATH);
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// SQS Client configuration
const isLocal = process.env.DB_LOCAL === "true";
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function sendToQueue(payload: any) {
  if (isLocal) {
    // Local simulation: Append message to the local JSON queue file
    let queue: any[] = [];
    if (fs.existsSync(QUEUE_FILE_PATH)) {
      try {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE_PATH, "utf-8"));
      } catch (e) {
        queue = [];
      }
    }
    
    // Simulate SQS Message structure
    const message = {
      MessageId: `msg-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      Body: JSON.stringify(payload),
      Timestamp: new Date().toISOString()
    };
    
    queue.push(message);
    fs.writeFileSync(QUEUE_FILE_PATH, JSON.stringify(queue, null, 2), "utf-8");
    console.log(`[LOCAL QUEUE] Telemetry enqueued for asset ${payload.assetId}. MessageId: ${message.MessageId}`);
    return { messageId: message.MessageId };
  } else {
    // Production: Push to real AWS SQS
    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error("SQS_QUEUE_URL environment variable is missing.");
    }
    
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
    });
    
    const response = await sqsClient.send(command);
    return { messageId: response.MessageId };
  }
}
