
import { spawn } from "child_process";
import path from "path";
import { app } from "electron";
import * as fs from "fs";

export class ScraperService {
  constructor() {}

  async getText(appName: string): Promise<string> {
    return new Promise((resolve, _reject) => {
      // Check if script exists
      const binaName = "text-extractor";
      let binPath = "";
      
      if (app.isPackaged) {
          binPath = path.join(process.resourcesPath, "bin", binaName);
      } else {
          // In dev, resources are in the project root
          binPath = path.join(process.cwd(), "resources", "bin", binaName);
      }

      let cmd = "";
      let args: string[] = [];

      // If binary exists, use it (even in dev)
      if (fs.existsSync(binPath)) {
          cmd = binPath;
          args = [appName];
      } else {
          // Fallback: use Swift script wrapper
          cmd = "bash";
          const wrapperPath = app.isPackaged
            ? path.join(process.resourcesPath, "scripts", "text-extractor.sh")
            : path.join(process.cwd(), "scripts", "text-extractor.sh");

          args = [wrapperPath, appName];
      }

      console.log(`[Scraper] Executing: ${cmd} ${args.join(" ")}`);

      const child = spawn(cmd, args);
      let output = "";
      let error = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        error += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          console.warn(`[Scraper] Exited with code ${code}: ${error}`);
          // Check for permission error
          if (error.includes("Accessibility") || output.includes("Accessibility")) {
              import("electron").then(({ BrowserWindow }) => {
                  BrowserWindow.getAllWindows().forEach(win => {
                      win.webContents.send('watcher:permission-denied');
                  });
              });
          }
          resolve(""); 
        } else {
          resolve(output.trim());
        }
      });
      
      // Timeout (longer for large chats)
      const timeoutMs = 20000;
      const timeout = setTimeout(() => {
          console.warn(`[Scraper] Timeout after ${timeoutMs}ms, returning partial output.`);
          child.kill();
          resolve(output.trim());
      }, timeoutMs);

      child.on("close", () => {
          clearTimeout(timeout);
      });
    });
  }
}

export const scraper = new ScraperService();
