# Judge Evaluation Guide: LifecycleZero Sandbox Demo

Welcome to the **LifecycleZero Sandbox Demo**! This guide walks you through launching the local-first zero-trust sandbox, configuring your local LLM (Ollama), running simulated security threat vectors, and verifying threat isolation.

---

## 1. Quick Launch Checklist

1. **Start the Application:**
   Make sure the Next.js portal is running locally (or access your hosted Vercel deployment URL):
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

### Step 2: Configure CORS (Crucial for Web Access)
Because the browser makes client-side requests directly to your local Ollama port (`11434`) to check connectivity and verify model names, **CORS must be enabled** on your local Ollama instance. 

* **On Windows:**
  1. Close the Ollama tray app from your taskbar.
  2. Open PowerShell or Command Prompt and run:
     ```powershell
     $env:OLLAMA_ORIGINS="*"
     ollama serve
     ```
  3. Keep this terminal window open.
* **On macOS / Linux:**
  1. Stop your running Ollama service.
  2. Start Ollama in your terminal with the environment variable set:
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```

### Step 3: Download & Run a Model
Open a new terminal window and pull your preferred local model. For example:
```bash
# To run llama3:
ollama run llama3

# Or to run qwen2.5-coder:7b:
ollama run qwen2.5-coder:7b
```

### Step 4: Configure Ollama in the Sandbox Dashboard
1. Scroll down to the **Threat Simulation Sandbox** card on the right-hand side of the Security Console.
2. In the **Ollama Configuration** header, verify the inputs:
   - **Endpoint:** `http://localhost:11434`
   - **Model Name Dropdown:** Select from popular local presets:
     - `llama3`
     - `qwen2.5-coder:7b`
     - `mistral`
     - `gemma`
     - `phi3`
     - **`Custom Model...`** (Select this if you are running a custom model name. An input field will dynamically slide open below the dropdown for you to type your custom name).
3. Click **Apply Local Model Config** to save.

---

## 3. Real-Time Connection & Model Verification

When you click **Apply Local Model Config** or select **PURE OLLAMA**, the system performs real-time connection verification:
* **Connection Check:** It attempts to contact your Ollama endpoint. If Ollama is offline or CORS is not enabled, it blocks saving and displays:
  `✘ Failed to connect to local Ollama at 'http://localhost:11434'. Make sure Ollama is running and CORS is enabled.`
* **Model Check:** It queries the installed models on your machine. If the selected model is not downloaded locally, it blocks saving and lists your installed models:
  `✘ Model 'your-model' not found on this Ollama instance. Installed models: llama3, qwen2.5-coder:7b`
* **Success State:** If both checks pass, it updates the database and displays:
  `✔ Successfully connected to 'your-model'!`

---

## 4. Threat Simulation Walkthrough

LifecycleZero provides four pre-built threat simulation scenarios. Choose between **HYBRID** (heuristic rules bypass) or **PURE OLLAMA** (synchronous local LLM routing) mode:

### Scenario A: Rogue Local Model Data Access (Critical)
* **What happens:** Simulates a local LLM processor (`llama.cpp`) attempting to read a sensitive payroll spreadsheet (`auth_tokens.json`).
* **Execution:** Select **Local LLM accessing auth_tokens.json** -> Click **Inject Threat Vector**.
* **Verification:**
  - **In Hybrid Mode:** Instantly checks static signatures, flags the host `AST-M3PRO-001` as a **CRITICAL** threat, and triggers the audio alarm.
  - **In Pure Ollama Mode:** Synchronously routes the payload to your local model. The terminal log displays the model's raw reasoning. The alert is normalized, saved to the DynamoDB sparse index, and instantly pushes to the **Security Incident Feed**.

### Scenario B: Developer Tool Configuration Access (Warning)
* **What happens:** Simulates a sanctioned IDE/compiler (`cursor.exe`) reading a secure database credential file (`credentials.db`).
* **Execution:** Select **Cursor IDE reading credentials.db** -> Click **Inject Threat Vector**.
* **Verification:** Flags the host as a **WARNING** threat (yellow node). It logs the action for compliance review, but does not trigger the containment quarantine.

### Scenario C: Sanctioned Developer Operation (Safe)
* **What happens:** Simulates normal development activity (`code.exe` accessing standard source files).
* **Execution:** Select **VSCode accessing source code** -> Click **Inject Threat Vector**.
* **Verification:** Evaluates the activity as **SAFE** (green node). No alerts are generated.

### Scenario D: Silent Agent / Unreachable Host
* **What happens:** Simulates an asset whose security daemon has stopped reporting heartbeats.
* **Execution:** Select **Simulate Host Silence (10m Offline)** -> Click **Inject Threat Vector**.
* **Verification:** The corresponding host node on the Fleet Grid turns orange (unreachable).

---

## 5. Validating Zero-Trust Containment

When a critical threat is active, you can quarantine the asset to neutralize the threat:

1. Click on the compromised host (represented as a pulsing red block in the 3D/2D grid, or select it from the **Security Incident Feed**).
2. Inside the Asset Details overlay, click **Isolate Host** and type a reason (e.g. "Rogue LLM access").
3. **Observe the Containment Actions:**
   - The host node immediately turns grey (Quarantined/Offline).
   - The **Active Threats** and **Rogue Models** metrics counters at the top of the screen immediately diminish, showing the threat has been neutralized.
   - Try to inject a new threat vector for this host; the simulator log will show `[RESPONSE 403] FAILED: FORBIDDEN_ISOLATED`. The Edge API gateway is blocking all incoming network ingress/egress for this device.
4. Once verified, click **Restore Host** to return the asset to service.

---

## 6. Navigation & Workspace Switching

If you want to transition between the sandbox demo and the real enterprise environment:
- **Proceed to Enterprise:** Click this button in the header (or the sidebar Demo Controls) to exit the demo and load the real authenticated Enterprise dashboard.
- **Return Home:** Click this button to return to the welcome landing screen.
- **Fleet Dashboard:** Click this button to view the hardware assets table, edit procurement requests, or review device hardware specifications.
