import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isDevelopment = process.env.NODE_ENV === "development";

const clientConfig: any = {
  region: process.env.AWS_REGION || "us-east-1",
  maxAttempts: 5, // Retries with exponential backoff to handle provisioning spikes
};

// Automatically routing queries to the local Docker engine during code iteration
if (process.env.DB_LOCAL === "true") {
  clientConfig.endpoint = "http://localhost:8000";
  clientConfig.credentials = {
    accessKeyId: "local",
    secretAccessKey: "local",
  };
}

const coreClient = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(coreClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});
