import { spawn, ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";
import * as fs from "fs";
import os from "os";

// Get the models directory in user's app support folder
function getModelsDir(): string {
    const platform = process.platform;
    let appDataDir: string;
    
    if (platform === 'darwin') {
        appDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'My Memories');
    } else if (platform === 'win32') {
        appDataDir = path.join(process.env.APPDATA || os.homedir(), 'My Memories');
    } else {
        appDataDir = path.join(os.homedir(), '.my-memories');
    }
    
    return path.join(appDataDir, 'models');
}

export class LLMService {
  private server: ChildProcess | null = null;
  private port = 8080;
  private modelPath: string;
  private mmProjPath: string;
  private initialized = false;

  constructor() {
    const modelsDir = getModelsDir();
    this.modelPath = path.join(modelsDir, "Qwen3-VL-4B-Instruct-Q4_K_M.gguf");
    this.mmProjPath = path.join(modelsDir, "mmproj-Qwen3VL-4B-Instruct-F16.gguf");
  }

  // Check if models are downloaded
  modelsExist(): boolean {
    return fs.existsSync(this.modelPath) && fs.existsSync(this.mmProjPath);
  }

  getModelsDir(): string {
    return getModelsDir();
  }

  async init() {
    if (this.initialized) return;

    // Check if models exist
    if (!this.modelsExist()) {
      console.error(`[LLMService] Models not found. Please download them first.`);
      console.error(`[LLMService] Expected model: ${this.modelPath}`);
      console.error(`[LLMService] Expected mmproj: ${this.mmProjPath}`);
      throw new Error("Models not downloaded. Please complete onboarding to download the AI model.");
    }

    const binName = "llama-server";
    let serverPath = "";

    if (app.isPackaged) {
        serverPath = path.join(process.resourcesPath, "bin", binName);
    } else {
        serverPath = path.join(app.getAppPath(), "resources", "bin", binName);
    }

    if (!fs.existsSync(serverPath)) {
        console.error(`[LLMService] llama-server binary not found at ${serverPath}`);
        const altPath = path.join(process.cwd(), "resources", "bin", binName);
        if (fs.existsSync(altPath)) {
            serverPath = altPath;
        } else {
            console.error(`[LLMService] llama-server binary also not found at ${altPath}`);
            return;
        }
    }

    console.log(`[LLMService] Starting llama-server from ${serverPath}`);
    console.log(`[LLMService] Model: ${this.modelPath}`);

    this.server = spawn(serverPath, [
      "-m", this.modelPath,
      "--mmproj", this.mmProjPath,
      "--port", String(this.port),
      "--host", "127.0.0.1",
      "--image-min-tokens", "2048",
      "-c", "32000"
    ]);

    this.server.stderr?.on("data", (data) => {
      console.log(`[llama-server] ${data}`);
    });

    this.server.on("close", (code) => {
        console.log(`[llama-server] exited with code ${code}`);
        this.server = null;
        this.initialized = false;
    });

    try {
        await this.waitForReady();
        console.log("[LLMService] Vision server ready!");
        this.initialized = true;
    } catch (e) {
        console.error("[LLMService] Failed to start server:", e);
        this.stop();
    }
  }

  private async waitForReady(timeout = 60000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`);
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Server failed to start");
  }

  async chat(message: string, images: string[] = [], timeoutMs: number = 300000): Promise<string> {
    if (!this.initialized) {
        await this.init();
        if (!this.initialized) {
             throw new Error("LLM Service not ready");
        }
    }

    try {
        const messages: any[] = [{
            role: "user",
            content: []
        }];

        messages[0].content.push({ type: "text", text: message });

        for (const imgPath of images) {
            try {
                const imageBuffer = fs.readFileSync(imgPath);
                const base64 = imageBuffer.toString("base64");
                const mime = imgPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

                messages[0].content.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${mime};base64,${base64}`
                    }
                });
            } catch (readErr) {
                console.error(`[LLMService] Failed to read image ${imgPath}:`, readErr);
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        console.log(`[LLMService] Starting LLM request (timeout: ${timeoutMs/1000}s)...`);

        const response = await fetch(`http://127.0.0.1:${this.port}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: messages,
                max_tokens: 8192,
                temperature: 0.7
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`LLM Server Error: ${response.status} ${errText}`);
        }

        const data: any = await response.json();
        console.log('[LLMService] LLM request completed');
        return data.choices?.[0]?.message?.content ?? "";

    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.error("[LLMService] Request timed out");
            throw new Error("LLM request timed out - try a shorter prompt");
        }
        console.error("[LLMService] Chat error:", e);
        throw e;
    }
  }

  stop() {
    if (this.server) {
        this.server.kill();
        this.server = null;
        this.initialized = false;
    }
  }

  isReady() {
      return this.initialized;
  }
}

export const llm = new LLMService();

app.on("before-quit", () => {
    llm.stop();
});
