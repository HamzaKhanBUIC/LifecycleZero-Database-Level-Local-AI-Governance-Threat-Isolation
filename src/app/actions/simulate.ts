"use server";

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../../lib/dynamodb";

import { env } from "../../lib/env";

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

/**
 * Server action to simulate an agent going silent by setting LastHeartbeat to 10 minutes ago.
 */
export async function simulateSilentHost(tenantId: string, assetId: string) {
  const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
  
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` },
      UpdateExpression: "SET LastHeartbeat = :ts",
      ExpressionAttributeValues: {
        ":ts": timestamp
      }
    }));
    
    console.log(`[SIMULATION] Set asset ${assetId} heartbeat to silent: ${timestamp}`);
    return { success: true, message: `Successfully simulated agent silence on ${assetId}.` };
  } catch (error: any) {
    console.error("Failed to simulate silent agent:", error);
    return { success: false, error: error.message || "Database update failed." };
  }
}
