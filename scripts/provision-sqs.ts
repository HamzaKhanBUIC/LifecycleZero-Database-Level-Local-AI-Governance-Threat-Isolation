import dotenv from "dotenv";
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
} from "@aws-sdk/client-sqs";

dotenv.config({ path: ".env.local" });

const QUEUE_NAME = "LifecycleZero_TelemetryQueue";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

async function provision() {
  const isLocal = process.env.DB_LOCAL === "true";

  if (isLocal) {
    console.error("❌ This script targets production AWS. Set DB_LOCAL=false in your .env.local.");
    process.exit(1);
  }

  console.log(`🚀 Provisioning SQS Queue "${QUEUE_NAME}" in region ${process.env.AWS_REGION || "us-east-1"}...`);

  // Check if queue already exists
  try {
    const existing = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: QUEUE_NAME })
    );
    console.log(`⚠️  Queue already exists.`);
    console.log(`\n✅ SQS Queue URL (existing):\n`);
    console.log(`   ${existing.QueueUrl}\n`);
    console.log(`📋 Copy this into your Vercel Environment Variables as SQS_QUEUE_URL`);
    return;
  } catch (e: any) {
    if (e.name !== "QueueDoesNotExist" && e.__type !== "AWS.SimpleQueueService.NonExistentQueue") {
      // Not a "not found" error — rethrow
      throw e;
    }
  }

  // Create the queue
  const result = await sqsClient.send(
    new CreateQueueCommand({
      QueueName: QUEUE_NAME,
      Attributes: {
        // 4-day message retention (max for standard queues)
        MessageRetentionPeriod: "345600",
        // 30-second visibility timeout (worker processes within this window)
        VisibilityTimeout: "30",
        // Long-polling enabled by default
        ReceiveMessageWaitTimeSeconds: "5",
      },
    })
  );

  const queueUrl = result.QueueUrl;

  console.log(`\n🎉 SQS Queue created successfully!\n`);
  console.log(`   Queue Name : ${QUEUE_NAME}`);
  console.log(`   Region     : ${process.env.AWS_REGION || "us-east-1"}`);
  console.log(`\n✅ SQS Queue URL:\n`);
  console.log(`   ${queueUrl}\n`);
  console.log(`📋 Copy this into your Vercel Environment Variables as SQS_QUEUE_URL`);
  console.log(`   Also add it to your local .env.local if you want to run the worker locally against production SQS.`);
}

provision().catch((err) => {
  console.error("❌ SQS provisioning failed:", err);
  process.exit(1);
});
