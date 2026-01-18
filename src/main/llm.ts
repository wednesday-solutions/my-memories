import { spawn, ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";
import * as fs from "fs";

export class LLMService {
  private server: ChildProcess | null = null;
  private port = 8080; // Default llama-server port or custom
  private modelPath: string;
  private mmProjPath: string;
  private initialized = false;

  constructor() {
    this.modelPath = path.join(process.resourcesPath, "models", "qwen2.5-vl-3b-instruct-q4_k_m.gguf");
    this.mmProjPath = path.join(process.resourcesPath, "models", "qwen2.5-vl-3b-instruct-mmproj-f16.gguf");

    // In dev mode, resources might be in a different place
    if (process.env.NODE_ENV === 'development') {
       this.modelPath = path.join(app.getAppPath(), 'resources', 'models', 'qwen2.5-vl-3b-instruct-q4_k_m.gguf');
       this.mmProjPath = path.join(app.getAppPath(), 'resources', 'models', 'qwen2.5-vl-3b-instruct-mmproj-f16.gguf');
    }
  }

  async init() {
    if (this.initialized) return;

    const binName = "llama-server"; // Binary name
    let serverPath = "";

    // Locate the binary
    if (app.isPackaged) {
        serverPath = path.join(process.resourcesPath, "bin", binName);
    } else {
        // In dev, assume it's in resources/bin/ relative to project root
        // app.getAppPath() points to the root in electron-vite dev usually, or dist/main
        // Let's try to find it in reasonable locations
        serverPath = path.join(app.getAppPath(), "resources", "bin", binName);
    }

    if (!fs.existsSync(serverPath)) {
        console.error(`[LLMService] llama-server binary not found at ${serverPath}`);
        // Fallback check for dev environment if path differs
        const altPath = path.join(process.cwd(), "resources", "bin", binName);
        if (fs.existsSync(altPath)) {
            serverPath = altPath;
        } else {
            console.error(`[LLMService] llama-server binary also not found at ${altPath}`);
            return; // Cannot start
        }
    }

    if (!fs.existsSync(this.modelPath)) {
        console.error(`[LLMService] Model not found at ${this.modelPath}`);
        return;
    }

    console.log(`[LLMService] Starting llama-server from ${serverPath}`);
    console.log(`[LLMService] Model: ${this.modelPath}`);

    // Spawn the server
    this.server = spawn(serverPath, [
      "-m", this.modelPath,
      "--mmproj", this.mmProjPath,
      "--port", String(this.port),
      "--host", "127.0.0.1",
      "-c", "8192" // Context size
    ]);



    this.server.stderr?.on("data", (data) => {
      console.log(`[llama-server] ${data}`);
    });

    this.server.on("close", (code) => {
        console.log(`[llama-server] exited with code ${code}`);
        this.server = null;
        this.initialized = false;
    });

    // Wait for health check
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

  async chat(message: string, images: string[] = []): Promise<string> {
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

        // Add text prompt
        messages[0].content.push({ type: "text", text: message });

        // Add images if any
        for (const imgPath of images) {
            try {
                const imageBuffer = fs.readFileSync(imgPath);
                const base64 = imageBuffer.toString("base64");
                // Guess mime type roughly or default to png/jpeg
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

        // If no images were added (or failed), we can simplify content to string if we wanted, 
        // but keeping it as array is valid for multimodal models usually.
        // However, if the images array was empty to begin with, standard text content string is safer for some endpoints,
        // but OpenAI API supports content array for text-only too.
        
        const response = await fetch(`http://127.0.0.1:${this.port}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: messages,
                max_tokens: 1280000,
                temperature: 0.7 // Optional
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`LLM Server Error: ${response.status} ${errText}`);
        }

        const data: any = await response.json();
        return data.choices?.[0]?.message?.content ?? "";

    } catch (e) {
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

// Ensure cleanup on app exit
app.on("before-quit", () => {
    llm.stop();
});
