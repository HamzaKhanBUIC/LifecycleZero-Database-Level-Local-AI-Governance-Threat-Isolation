import { AgentTelemetry } from "./types";
import { GoogleGenAI } from "@google/genai";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { env } from "./env";

// Bypass local corporate proxy TLS issues only in development
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Standard OpenAI SDK which Groq uses
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Robust JSON parser that extracts JSON blocks using regex fallback
 */
function safeParseJSON(text: string): any {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        console.error("Failed to parse extracted JSON block:", innerErr, "Original text:", text);
      }
    }
    throw new Error(`Failed to parse LLM response: ${text.substring(0, 100)}...`);
  }
}

/**
 * Sends the telemetry to AWS Bedrock (Claude 3 Haiku) for enterprise security evaluation.
 */
async function evaluateWithBedrock(telemetry: AgentTelemetry): Promise<RiskEvaluation> {
  const bedrockClient = new BedrockRuntimeClient({
    region: env("AWS_REGION", "us-east-1"),
    ...(env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY") && {
      credentials: {
        accessKeyId: env("AWS_ACCESS_KEY_ID"),
        secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
      }
    }),
  });

  const prompt = `You are a Zero-Trust Agentic Security AI.
Evaluate the following telemetry from an employee's machine.
Determine if the local AI model is accessing highly sensitive company data or behaving suspiciously.

Telemetry Data:
- Process: ${telemetry.ProcessName}
- CPU Usage: ${telemetry.CpuUsage}%
- RAM Usage: ${telemetry.RamUsage}GB
- Network Egress: ${telemetry.NetworkEgress}MB
- Files Accessed: ${telemetry.FilesAccessed.join(", ") || "None"}

Respond ONLY in JSON format:
{
  "riskLevel": "SAFE" | "WARNING" | "CRITICAL",
  "reasoning": "A 1-sentence explanation of the decision."
}`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 250,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          }
        ]
      }
    ],
    temperature: 0.1
  };

  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const textContent = responseBody.content[0].text;
  
  return safeParseJSON(textContent);
}

/**
 * Interface representing the AI engine's evaluation.
 */
export interface RiskEvaluation {
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
  reasoning: string;
}

/**
 * Sends the telemetry to Groq for extremely fast evaluation.
 */
async function evaluateWithGroq(telemetry: AgentTelemetry): Promise<RiskEvaluation> {
  if (!env("GROQ_API_KEY")) throw new Error("GROQ_API_KEY missing");

  const prompt = `You are a Zero-Trust Agentic Security AI.
Evaluate the following telemetry from an employee's machine.
Determine if the local AI model is accessing highly sensitive company data or behaving suspiciously.

Telemetry Data:
- Process: ${telemetry.ProcessName}
- CPU Usage: ${telemetry.CpuUsage}%
- RAM Usage: ${telemetry.RamUsage}GB
- Network Egress: ${telemetry.NetworkEgress}MB
- Files Accessed: ${telemetry.FilesAccessed.join(", ") || "None"}

Respond ONLY in JSON format:
{
  "riskLevel": "SAFE" | "WARNING" | "CRITICAL",
  "reasoning": "A 1-sentence explanation of the decision."
}`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env("GROQ_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192", // Supported Fast model on Groq
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API Error: ${err}`);
  }

  const data = await response.json();
  return safeParseJSON(data.choices[0].message.content);
}

/**
 * Fallback to Google Gemini if Groq fails.
 */
async function evaluateWithGemini(telemetry: AgentTelemetry): Promise<RiskEvaluation> {
  if (!env("GEMINI_API_KEY")) throw new Error("GEMINI_API_KEY missing");

  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  const prompt = `You are a Zero-Trust Agentic Security AI.
Evaluate the following telemetry from an employee's machine.
Determine if the local AI model is accessing highly sensitive company data or behaving suspiciously.

Telemetry Data:
- Process: ${telemetry.ProcessName}
- CPU Usage: ${telemetry.CpuUsage}%
- RAM Usage: ${telemetry.RamUsage}GB
- Network Egress: ${telemetry.NetworkEgress}MB
- Files Accessed: ${telemetry.FilesAccessed.join(", ") || "None"}

Respond ONLY in JSON format:
{"riskLevel": "SAFE" | "WARNING" | "CRITICAL", "reasoning": "..."}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // Fast fallback
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  if (!response.text) {
    throw new Error("Gemini returned empty response");
  }
  return safeParseJSON(response.text);
}

const OLLAMA_API_URL = env("OLLAMA_API_URL", "http://localhost:11434/api/generate");

/**
 * Sends telemetry to a local Ollama instance for privacy-first evaluation.
 */
async function evaluateWithOllama(telemetry: AgentTelemetry): Promise<RiskEvaluation> {
  const prompt = `You are a Zero-Trust Agentic Security AI.
Evaluate the following telemetry from an employee's machine.
Determine if the local AI model is accessing highly sensitive company data or behaving suspiciously.

Telemetry Data:
- Process: ${telemetry.ProcessName}
- CPU Usage: ${telemetry.CpuUsage}%
- RAM Usage: ${telemetry.RamUsage}GB
- Network Egress: ${telemetry.NetworkEgress}MB
- Files Accessed: ${telemetry.FilesAccessed.join(", ") || "None"}

Respond ONLY in JSON format like this: {"riskLevel": "SAFE" | "WARNING" | "CRITICAL", "reasoning": "1 sentence explanation."}`;

  const response = await fetch(OLLAMA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env("OLLAMA_MODEL", "llama3"),
      prompt: prompt,
      format: "json",
      stream: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama API Error: ${err}`);
  }

  const data = await response.json();
  return safeParseJSON(data.response);
}

/**
 * Main evaluation router. Tries primary provider, falls back if needed.
 */
export async function evaluateTelemetryRisk(telemetry: AgentTelemetry): Promise<RiskEvaluation> {
  const processLower = telemetry.ProcessName.toLowerCase();
  const files = telemetry.FilesAccessed || [];
  const cpu = telemetry.CpuUsage || 0;
  const egress = telemetry.NetworkEgress || 0;

  // =========================================================================
  // TIER 1: DETERMINISTIC BYPASS (Zero-Cost Filter)
  // =========================================================================
  if (files.length === 0) {
    if (cpu < 80 && egress < 100) {
      return {
        riskLevel: "SAFE",
        reasoning: "Tier 1: No file access events detected. Host resource usage behaves within normal operational parameters."
      };
    }
  }

  // =========================================================================
  // TIER 2: PATH & PROCESS SIGNATURE MATCHER (Static Rule Filtering)
  // =========================================================================
  const sensitivePatterns = [
    "auth_tokens", "payroll", "credential", "secret", "password", 
    "key", ".env", "id_rsa", "database", "backup", "ledger", "financial"
  ];
  
  const knownAiProcesses = [
    "llama.cpp", "ollama", "lmstudio", "python", "node", "ollama-runner"
  ];

  const hasSensitiveFile = files.some(file => {
    const fLower = file.toLowerCase();
    return sensitivePatterns.some(pattern => fLower.includes(pattern));
  });

  const isAiProcess = knownAiProcesses.some(proc => processLower.includes(proc));

  // If no sensitive files are touched and it's not a known model runner, bypass AI
  if (!isAiProcess && !hasSensitiveFile) {
    return {
      riskLevel: "SAFE",
      reasoning: `Tier 2: Benign process '${telemetry.ProcessName}' accessing standard files.`
    };
  }

  // If it's a known developer tool (e.g. Cursor, VSCode) and no sensitive files are accessed
  if (processLower === "cursor.exe" || processLower === "code.exe" || processLower === "vscode") {
    if (!hasSensitiveFile) {
      return {
        riskLevel: "SAFE",
        reasoning: "Tier 2: Sanctioned developer IDE activity verified."
      };
    }
  }

  // =========================================================================
  // TIER 3: LLM EVALUATION (Escalation to Claude 3 Haiku / Failovers)
  // =========================================================================
  console.log(`[TIER 3] Escalating telemetry for asset ${telemetry.AssetId} to AI Evaluation...`);

  const primaryProvider = env("AI_PROVIDER_PRIMARY", "bedrock");

  try {
    if (primaryProvider === 'bedrock') {
      return await evaluateWithBedrock(telemetry);
    } else if (primaryProvider === 'ollama') {
      return await evaluateWithOllama(telemetry);
    } else if (primaryProvider === 'groq') {
      return await evaluateWithGroq(telemetry);
    } else {
      return await evaluateWithGemini(telemetry);
    }
  } catch (error) {
    console.warn(`⚠️ Primary AI Provider (${primaryProvider}) failed. Falling back... Error:`, error);
    
    // Fallback logic
    try {
      if (primaryProvider === 'bedrock') {
        if (env("GEMINI_API_KEY")) {
          return await evaluateWithGemini(telemetry);
        } else {
          return await evaluateWithGroq(telemetry);
        }
      } else if (primaryProvider === 'ollama' || primaryProvider === 'groq') {
        return await evaluateWithGemini(telemetry);
      } else {
        return await evaluateWithGroq(telemetry);
      }
    } catch (fallbackError) {
      console.error("❌ Both Primary and Fallback AI Providers failed!", fallbackError);
      return {
        riskLevel: 'WARNING',
        reasoning: 'System degraded: AI evaluation unavailable. Flagged for manual review.'
      };
    }
  }
}

