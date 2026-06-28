# Judge Evaluation Guide: LifecycleZero Sandbox Demo

Welcome to the **LifecycleZero Sandbox Demo**! This guide will walk you through launching the local-first zero-trust sandbox, connecting your local LLM (Ollama), running simulated security threat vectors, and verifying threat isolation.

---

## 1. Quick Launch Checklist

1. **Start the Application:**
   Make sure the Next.js portal is running locally:
   ```bash
   npm run dev
   ```
2. **Access the Portal:**
   Open your browser and navigate to the welcome landing screen:
   [http://localhost:3000](http://localhost:3000)
3. **Launch the Demo Sandbox:**
   Click the **Launch Sandbox Demo** button (pulsing white CTA). This automatically bypasses authentication (Clerk) and auto-seeds the database with a mock fleet of **120-130 active nodes** so you can test the grid immediately.

---

## 2. Setting Up Your Local AI (Ollama)

To demonstrate the **local-only, data-privacy-first AI governance** of LifecycleZero, you can connect your laptop's local Ollama instance directly to the security routing engine.

### Step 1: Install Ollama
Download and install Ollama for your operating system from [ollama.com](https://ollama.com).

### Step 2: Download & Run a Model
Open a terminal on your machine and start your preferred model (we recommend `llama3` or `qwen2.5-coder:7b`):
```bash
# To run llama3:
ollama run llama3

# Or to run qwen2.5-coder:
ollama run qwen2.5-coder:7b
```
Ensure Ollama is running on port `11434` (the default).

### Step 3: Configure Ollama in the Sandbox
1. Scroll down to the **Threat Simulation Sandbox** cockpit card on the right-hand side of the Security Console.
2. Under the **Ollama Configuration** header, verify the inputs:
   - **Endpoint:** `http://localhost:11434`
   - **Model Name:** `llama3` (or `qwen2.5-coder:7b` if you downloaded that instead)
3. Click **Apply Local Model Config** to save.
4. Click the mode button in the configuration header to toggle it from **Signature + Heuristic** to **Pure Ollama** mode.

---

## 3. Threat Simulation Walkthrough

LifecycleZero provides four pre-built threat simulation scenarios.

### Scenario A: Rogue Local Model Data Access (Critical)
* **What happens:** Simulates a local LLM processor (`llama.cpp`) attempting to read a sensitive database file (`auth_tokens.json`).
* **Execution:**
  1. Select **Local LLM accessing auth_tokens.json** from the dropdown.
  2. Click **Inject Threat Vector**.
  3. **Verification:**
     - **In Hybrid Signature Mode:** Instantly checks static rules, flags the host `AST-M3PRO-001` as a **CRITICAL** threat, and triggers the audio alarm.
     - **In Pure Ollama Mode:** Synchronously routes the payload to your local model. The terminal log displays the model's raw reasoning. The alert is normalized, saved to the DynamoDB sparse index, and instantly pushes to the **Security Incident Feed**.

### Scenario B: Developer Tool Configuration Access (Warning)
* **What happens:** Simulates a sanctioned IDE/compiler (`cursor.exe`) reading a secure database credential file (`credentials.db`).
* **Execution:**
  1. Select **Cursor IDE reading credentials.db** from the dropdown.
  2. Click **Inject Threat Vector**.
  3. **Verification:**
     - Flags the host as a **WARNING** threat (yellow node). It logs the action for compliance review, but does not trigger the containment quarantine.

### Scenario C: Sanctioned Developer Operation (Safe)
* **What happens:** Simulates normal development activity (`code.exe` accessing standard source files).
* **Execution:**
  1. Select **VSCode accessing source code** from the dropdown.
  2. Click **Inject Threat Vector**.
  3. **Verification:**
     - Evaluates the activity as **SAFE** (green node). No alerts are generated.

### Scenario D: Silent Agent / Unreachable Host
* **What happens:** Simulates an asset whose security daemon has stopped reporting heartbeats.
* **Execution:**
  1. Select **Simulate Host Silence (10m Offline)** from the dropdown.
  2. Click **Inject Threat Vector**.
  3. **Verification:**
     - The corresponding host node on the Fleet Grid turns orange (unreachable).

---

## 4. Validating Zero-Trust Containment

When a critical threat is active, you can quarantine the asset to neutralize the threat:

1. Click on the compromised host (represented as a pulsing red block in the 3D/2D grid, or select it from the **Security Incident Feed**).
2. Inside the Asset Details overlay, click **Isolate Host** and type a reason (e.g. "Rogue LLM access").
3. **Observe the Containment Actions:**
   - The host node immediately turns grey (Quarantined/Offline).
   - The **Active Threats** and **Rogue Models** metrics counters at the top of the screen immediately diminish, showing the threat has been neutralized.
   - Try to inject a new threat vector for this host; the simulator log will show `[RESPONSE 403] FAILED: FORBIDDEN_ISOLATED`. The Edge API gateway is blocking all incoming network ingress/egress for this device.
4. Once verified, click **Restore Host** to return the asset to service.

---

## 5. Navigation & Workspace Switching

If you want to transition between the sandbox demo and the real enterprise environment:
- **Proceed to Enterprise:** Click this button in the header (or the sidebar Demo Controls) to exit the demo and load the real authenticated Enterprise dashboard.
- **Return Home:** Click this button to return to the welcome landing screen.
- **Fleet Dashboard:** Click this button to view the hardware assets table, edit procurement requests, or review device hardware specifications.
