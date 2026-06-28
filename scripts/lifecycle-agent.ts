import { execSync } from "child_process";
import os from "os";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });

const INGEST_URL = process.env.INGEST_URL || "http://localhost:3000/api/ingest";
const TENANT_ID = process.env.TENANT_ID || "org_demo_123";
const ASSET_ID = process.argv[2] || "AST-M3PRO-001"; // Alice Chen's MacBook Pro
const AGENT_KEY = process.argv[3] || process.env.AGENT_API_KEY || "demo_agent_key_99";

// Benign vs Threat processes we want to detect
const BENIGN_PROCESSES = ["chrome.exe", "vscode.exe", "docker", "slack", "zoom", "node.exe", "powershell.exe"];
const THREAT_PROCESSES = ["llama.cpp", "ollama", "copilot-local", "jan.ai", "lmstudio"];
const SENSITIVE_FILES = ["payroll_2026.xlsx", "q3_roadmap_confidential.pdf", "customer_pii.csv", "auth_tokens.json"];

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = os.cpus().map((cpu) => cpu.times);
    setTimeout(() => {
      const endMeasure = os.cpus().map((cpu) => cpu.times);
      let totalDiff = 0;
      let idleDiff = 0;
      for (let i = 0; i < startMeasure.length; i++) {
        const start = startMeasure[i];
        const end = endMeasure[i];
        const totalStart = start.user + start.nice + start.sys + start.idle + start.irq;
        const totalEnd = end.user + end.nice + end.sys + end.idle + end.irq;
        totalDiff += totalEnd - totalStart;
        idleDiff += end.idle - start.idle;
      }
      const cpuPercentage = totalDiff === 0 ? 0 : 100 - Math.floor((100 * idleDiff) / totalDiff);
      resolve(cpuPercentage);
    }, 500);
  });
}

function getHardwareUuid(): string {
  try {
    const platform = os.platform();
    if (platform === "win32") {
      const output = execSync("wmic csproduct get uuid", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const lines = output.split("\r\n").map(l => l.trim()).filter(l => l.length > 0 && l !== "UUID");
      return lines[0] || "WIN-HW-MOCK-UUID";
    } else if (platform === "darwin") {
      const output = execSync("system_profiler SPHardwareDataType | awk '/Hardware UUID/ {print $3}'", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      return output.trim() || "MAC-HW-MOCK-UUID";
    } else {
      // Linux
      const output = execSync("cat /sys/class/dmi/id/product_uuid", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      return output.trim() || "LINUX-HW-MOCK-UUID";
    }
  } catch {
    return `FALLBACK-HW-UUID-${os.hostname()}`;
  }
}

function getLocalProcesses(): string[] {
  try {
    const platform = os.platform();
    if (platform === "win32") {
      // Windows: tasklist in CSV format
      const output = execSync("tasklist /FO CSV /NH", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const lines = output.split("\r\n");
      const processes = lines
        .map((line) => {
          const match = line.match(/^"([^"]+)"/);
          return match ? match[1].toLowerCase() : "";
        })
        .filter((name) => name.length > 0);
      return Array.from(new Set(processes));
    } else {
      // macOS / Linux: ps command
      const output = execSync("ps -ax -o comm", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const lines = output.split("\n");
      const processes = lines
        .map((line) => {
          const trimmed = line.trim();
          const parts = trimmed.split("/");
          return parts[parts.length - 1].toLowerCase();
        })
        .filter((name) => name.length > 0 && name !== "comm");
      return Array.from(new Set(processes));
    }
  } catch (error) {
    console.warn("⚠️ Failed to query real process list, using fallback.", error);
    return BENIGN_PROCESSES;
  }
}

async function runAgent() {
  const hardwareUuid = getHardwareUuid();
  let activeAgentKey = AGENT_KEY;

  console.log(`🔒 LifecycleZero Endpoint Agent starting on host: ${os.hostname()}...`);
  console.log(`📡 Hardware UUID: ${hardwareUuid}`);
  console.log(`📡 Targeting Ingest API: ${INGEST_URL}`);
  console.log(`🖥️ Reporting status for Asset: ${ASSET_ID} (Tenant: ${TENANT_ID})`);

  // Telemetry loop
  while (true) {
    try {
      const cpu = await getCpuUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ram = Number(((totalMem - freeMem) / (1024 ** 3)).toFixed(2)); // GB used

      // 1. Get real process list
      const realProcesses = getLocalProcesses();

      // 2. Identify if any known processes are running, or decide to simulate an agentic threat
      // 15% chance to simulate a threat event running locally
      const simulateThreat = Math.random() < 0.15;
      let processName = "";
      let filesAccessed: string[] = [];
      let networkEgress = Math.floor(Math.random() * 10) + 1; // 1-10 MB default egress

      if (simulateThreat) {
        // Threat Simulation: pick one threat process and optionally access a sensitive file
        processName = THREAT_PROCESSES[Math.floor(Math.random() * THREAT_PROCESSES.length)];
        filesAccessed = [SENSITIVE_FILES[Math.floor(Math.random() * SENSITIVE_FILES.length)]];
        networkEgress = Math.floor(Math.random() * 300) + 50; // Spiked network egress
        console.log(`[ALERT/SIMULATE] Spawning threat process ${processName} accessing ${filesAccessed[0]}`);
      } else {
        // Look for actual benign processes running locally first, fallback to BENIGN_PROCESSES list
        const activeBenign = realProcesses.filter((p) => BENIGN_PROCESSES.includes(p));
        processName = activeBenign.length > 0 
          ? activeBenign[Math.floor(Math.random() * activeBenign.length)]
          : BENIGN_PROCESSES[Math.floor(Math.random() * BENIGN_PROCESSES.length)];
      }

      // 3. Construct Ingestion payload
      const payload = {
        tenantId: TENANT_ID,
        assetId: ASSET_ID,
        processName: processName,
        filesAccessed: filesAccessed,
        cpuUsage: cpu,
        ramUsage: ram,
        networkEgress: networkEgress,
        hardwareUuid: hardwareUuid,
      };

      // 4. Send telemetry POST to Next.js server
      const bodyStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", activeAgentKey)
        .update(bodyStr)
        .digest("hex");

      const response = await fetch(INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Key": activeAgentKey,
          "X-Agent-Signature": signature,
        },
        body: bodyStr,
      });

      const data: any = await response.json();

      if (response.ok) {
        console.log(
          `[INGEST SUCCESS] Process: ${payload.processName} | CPU: ${payload.cpuUsage}% | RAM: ${payload.ramUsage}GB | Network: ${payload.networkEgress}MB | QueueStatus: ${data.status} | MsgId: ${data.messageId}`
        );

        // Handshake: If server returns a device-specific rotated key, store it for future heartbeats
        if (data.agentKey && data.agentKey !== activeAgentKey) {
          console.log(`🔑 [CREDENTIAL ROTATION] Server issued unique device-specific agent key: ${data.agentKey}`);
          activeAgentKey = data.agentKey;
        }
      } else if (response.status === 403 && data.error === "FORBIDDEN_ISOLATED") {
        console.error(`❌ HOST ISOLATION ENFORCED: Ingestion API blocked this machine. Network egress restricted.`);
        console.error(`Reason: ${data.message}`);
        // Wait longer if isolated (simulating network throttling)
        await new Promise((resolve) => setTimeout(resolve, 15000));
      } else {
        console.error(`❌ Ingest API rejected payload: ${response.status} - ${data.error}: ${data.message || ""}`);
      }
    } catch (error: any) {
      console.error(`❌ Agent Telemetry push failed: ${error.message}`);
    }

    // Interval between 3 to 7 seconds
    const interval = Math.floor(Math.random() * 4000) + 3000;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

runAgent().catch(console.error);
