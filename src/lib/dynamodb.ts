import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "./env";

// All AWS env vars are sanitized via env() to strip PowerShell-injected UTF-8 BOM (\uFEFF)
const awsRegion    = env("AWS_REGION", "us-east-1");
const awsKeyId     = env("AWS_ACCESS_KEY_ID");
const awsSecretKey = env("AWS_SECRET_ACCESS_KEY");

const clientConfig: any = {
  region: awsRegion,
  maxAttempts: 5, // Retries with exponential backoff to handle provisioning spikes
};

// Explicitly pass sanitized credentials to bypass the SDK's default credential
// provider chain which reads directly from the (potentially BOM-corrupted) env vars
if (awsKeyId && awsSecretKey) {
  clientConfig.credentials = {
    accessKeyId: awsKeyId,
    secretAccessKey: awsSecretKey,
  };
}

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
