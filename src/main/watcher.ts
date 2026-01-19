import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { vision } from './vision';
// import { llm } from "./llm";
import { scraper } from "./scraper";
import { getDB } from './database'; // Need DB to save memories directly? Or send to renderer? 
// Better to send to renderer or use IPC handling flow? 
// Actually, watcher usually broadcasts. We can do side-effect logic here.

export class Watcher {
  private static child: ChildProcess | null = null;

  static start() {
    if (this.child) return;

    const isDev = !app.isPackaged;
    // In dev, usually compiled to electron/accessibility/watcher
    // In prod, it should be in Resources
    const binPath = isDev 
      ? path.join(process.cwd(), 'electron/accessibility/watcher')
      : path.join(process.resourcesPath, 'watcher'); 

    console.log("Spawning Watcher from:", binPath);

    this.child = spawn(binPath, []);

    this.child.stderr?.on('data', (data) => {
      console.error("Watcher Error:", data.toString());
      if (data.toString().includes("errm")) { // Permission denied check
           BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('watcher:permission-denied');
        });
      }
    });

    this.child.stdout?.on('data', (data) => {
      try {
        const str = data.toString().trim();
        if (!str) return;
        
        // Handle potentially multiple JSON objects in one chunk
        const lines = str.split('\n');
        for (const line of lines) {
             try {
                const json = JSON.parse(line);
                console.log("Watcher JSON received:", JSON.stringify(json).slice(0, 200)); // Debug log
                
                // Broadcast to all windows
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('watcher:data', json);
                });

                // VISION TRIGGER
                if (json.appName) {
                    this.handleVisionCapture(json.appName, json.title);
                }

             } catch (e) {
                 // Ignore partial lines or non-JSON
             }
        }
      } catch (e) {
        // console.error("Watcher Parse Error:", e);
      }
    });
  }

  // Simple debounce tracking
  private static lastCaptureTime: number = 0;
  private static CAPTURE_INTERVAL = 30000; // 30s
  private static lastTitle: string = "";

   // Parse output for Claude Desktop
   private static parseClaudeDesktopOutput(text: string): { 
       messages: { role: string, content: string, timestamp?: string }[],
       chatTitle?: string,
       windowTitle?: string,
       browserUrl?: string
   } {
       const messages: { role: string, content: string, timestamp?: string }[] = [];
       const lines = text.split('\n');
       
       let currentRole = "";
       let currentContent: string[] = [];
       let lastTimestamp = "";
       let chatTitle: string | undefined;
       let windowTitle: string | undefined;
       let browserUrl: string | undefined;

       const commitCurrent = () => {
           if (currentRole && currentContent.length > 0) {
               messages.push({ 
                   role: currentRole, 
                   content: currentContent.join('\n').trim(),
                   timestamp: lastTimestamp
               });
           }
       };

       for (const line of lines) {
           const trimmed = line.trim();
           
           // Extract titles
           if (trimmed.startsWith("[WINDOW_TITLE]")) {
               windowTitle = trimmed.replace("[WINDOW_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[BROWSER_URL]")) {
               browserUrl = trimmed.replace("[BROWSER_URL]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[CHAT_TITLE]")) {
               chatTitle = trimmed.replace("[CHAT_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[TITLE]")) {
               // Skip generic headers/titles so they don't get appended to messages
               continue;
           }
           
           if (trimmed.startsWith("[METADATA]")) {
               const timeStr = trimmed.replace("[METADATA]", "").trim();
               if (timeStr.match(/\d{1,2}:\d{2}/)) {
                   lastTimestamp = timeStr;
               }
               continue;
           }

           // Detect Semantic Roles
           if (trimmed.startsWith("[USER]")) {
               const nextContent = trimmed.replace("[USER]", "").trim();
               if (currentRole === "user") {
                   if (nextContent) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "user";
                   currentContent = nextContent ? [nextContent] : [];
               }
           } 
           else if (trimmed.startsWith("[ASSISTANT]")) {
               const nextContent = trimmed.replace("[ASSISTANT]", "").trim();
               if (currentRole === "assistant") {
                   if (nextContent) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "assistant";
                   currentContent = nextContent ? [nextContent] : [];
               }
           }
           // Handle continuation
           else if (currentRole) {
               const cleanLine = trimmed.replace(/^\[.*?\]/, "").trim();
               if (cleanLine) currentContent.push(cleanLine);
           }
       }
       
       // flush last
       commitCurrent();

       return { messages, chatTitle, windowTitle, browserUrl };
   }

   // Parse output for Claude Web
   private static parseClaudeWebOutput(text: string): { 
       messages: { role: string, content: string, timestamp?: string }[],
       chatTitle?: string,
       windowTitle?: string,
       browserUrl?: string
   } {
       const messages: { role: string, content: string, timestamp?: string }[] = [];
       const lines = text.split('\n');
       
       let currentRole = "";
       let currentContent: string[] = [];
       let lastTimestamp = "";
       let chatTitle: string | undefined;
       let windowTitle: string | undefined;
       let browserUrl: string | undefined;

       const commitCurrent = () => {
           if (currentRole && currentContent.length > 0) {
               messages.push({ 
                   role: currentRole, 
                   content: currentContent.join('\n').trim(),
                   timestamp: lastTimestamp
               });
           }
       };

       for (const line of lines) {
           const trimmed = line.trim();
           
           // Extract titles
           if (trimmed.startsWith("[WINDOW_TITLE]")) {
               windowTitle = trimmed.replace("[WINDOW_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[BROWSER_URL]")) {
               browserUrl = trimmed.replace("[BROWSER_URL]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[CHAT_TITLE]")) {
               chatTitle = trimmed.replace("[CHAT_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[TITLE]")) {
               // Skip generic headers/titles so they don't get appended to messages
               continue;
           }
           
           if (trimmed.startsWith("[METADATA]")) {
               const timeStr = trimmed.replace("[METADATA]", "").trim();
               if (timeStr.match(/\d{1,2}:\d{2}/)) {
                   lastTimestamp = timeStr;
               }
               continue;
           }

           // Detect Semantic Roles
           if (trimmed.startsWith("[USER]")) {
               const nextContent = trimmed.replace("[USER]", "").trim();
               if (currentRole === "user") {
                   if (nextContent) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "user";
                   currentContent = nextContent ? [nextContent] : [];
               }
           } 
           else if (trimmed.startsWith("[ASSISTANT]")) {
               const nextContent = trimmed.replace("[ASSISTANT]", "").trim();
               if (currentRole === "assistant") {
                   if (nextContent) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "assistant";
                   currentContent = nextContent ? [nextContent] : [];
               }
           }
           // Handle continuation
           else if (currentRole) {
               const cleanLine = trimmed.replace(/^\[.*?\]/, "").trim();
               if (cleanLine) currentContent.push(cleanLine);
           }
       }
       
       // flush last
       commitCurrent();

       return { messages, chatTitle, windowTitle, browserUrl };
   }

   // Parse output for ChatGPT Web
   private static parseChatGPTOutput(text: string): { 
       messages: { role: string, content: string, timestamp?: string }[],
       chatTitle?: string,
       windowTitle?: string,
       browserUrl?: string
   } {
       const messages: { role: string, content: string, timestamp?: string }[] = [];
       const lines = text.split('\n');
       
       let currentRole = "";
       let currentContent: string[] = [];
       let lastTimestamp = "";
       let chatTitle: string | undefined;
       let windowTitle: string | undefined;
       let browserUrl: string | undefined;

       const isNoiseLine = (value: string) => {
           const lower = value.toLowerCase();
           if (!lower) return true;
           const literals = [
               'chat history',
               'search chats',
               'images',
               'apps',
               'projects',
               'gpts',
               'explore gpts',
               'your chats',
               'new chat',
               'share',
               'skip to content',
               'settings',
               'help',
               'account',
               'upgrade',
               'plans',
               'billing',
               'log out',
                'logout',
                'chatgpt can make mistakes. check important info.',
                'cookie preferences',
                'improve',
                'reports',
                'critique',
                'write',
                'focus'
           ];
           if (literals.includes(lower)) return true;
           if (/^chatgpt\s*\d/.test(lower)) return true;
           if (lower.startsWith('chatgpt.com/')) return true;
           if (lower.startsWith('chat.openai.com/')) return true;
           return false;
       };

       const detectRoleLabel = (value: string): { role: 'user' | 'assistant'; remainder?: string } | null => {
           const lower = value.toLowerCase();
           const labels: Array<{ label: string; role: 'user' | 'assistant' }> = [
               { label: 'you said:', role: 'user' },
               { label: 'you:', role: 'user' },
               { label: 'chatgpt said:', role: 'assistant' },
               { label: 'chatgpt:', role: 'assistant' },
               { label: 'assistant:', role: 'assistant' }
           ];

           for (const entry of labels) {
               if (lower === entry.label) {
                   return { role: entry.role };
               }
               if (lower.startsWith(entry.label + ' ')) {
                   const remainder = value.slice(entry.label.length).trim();
                   return { role: entry.role, remainder };
               }
           }

           return null;
       };

       const commitCurrent = () => {
           if (currentRole && currentContent.length > 0) {
               const content = currentContent.join('\n').trim();
               if (content && !isNoiseLine(content)) {
                   messages.push({ 
                       role: currentRole, 
                       content,
                       timestamp: lastTimestamp
                   });
               }
           }
       };

       for (const line of lines) {
           const trimmed = line.trim();
           const lineWithoutTag = trimmed.replace(/^\[.*?\]\s*/, '').trim();
           const roleLabel = detectRoleLabel(lineWithoutTag);
           if (roleLabel) {
               commitCurrent();
               currentRole = roleLabel.role;
               currentContent = [];
               if (roleLabel.remainder && !isNoiseLine(roleLabel.remainder)) {
                   currentContent.push(roleLabel.remainder);
               }
               continue;
           }
           
           // Extract titles
           if (trimmed.startsWith("[WINDOW_TITLE]")) {
               windowTitle = trimmed.replace("[WINDOW_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[BROWSER_URL]")) {
               browserUrl = trimmed.replace("[BROWSER_URL]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[CHAT_TITLE]")) {
               chatTitle = trimmed.replace("[CHAT_TITLE]", "").trim();
               continue;
           }
           if (trimmed.startsWith("[TITLE]")) {
               // Skip generic headers/titles so they don't get appended to messages
               continue;
           }
           
           if (trimmed.startsWith("[METADATA]")) {
               const timeStr = trimmed.replace("[METADATA]", "").trim();
               if (timeStr.match(/\d{1,2}:\d{2}/)) {
                   lastTimestamp = timeStr;
               }
               continue;
           }

           // Detect Semantic Roles
           if (trimmed.startsWith("[USER]")) {
               const nextContent = trimmed.replace("[USER]", "").trim();
               if (currentRole === "user") {
                   if (nextContent && !isNoiseLine(nextContent)) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "user";
                   currentContent = nextContent && !isNoiseLine(nextContent) ? [nextContent] : [];
               }
           } 
           else if (trimmed.startsWith("[ASSISTANT]")) {
               const nextContent = trimmed.replace("[ASSISTANT]", "").trim();
               if (currentRole === "assistant") {
                   if (nextContent && !isNoiseLine(nextContent)) currentContent.push(nextContent);
               } else {
                   commitCurrent();
                   currentRole = "assistant";
                   currentContent = nextContent && !isNoiseLine(nextContent) ? [nextContent] : [];
               }
           }
           // Handle continuation
           else if (currentRole) {
               const cleanLine = trimmed.replace(/^\[.*?\]/, "").trim();
               if (cleanLine && !isNoiseLine(cleanLine)) currentContent.push(cleanLine);
           }
       }
       
       // flush last
       commitCurrent();

       return { messages, chatTitle, windowTitle, browserUrl };
   }

  private static extractBrowserUrl(text: string): string | undefined {
      const lines = text.split('\n');
      for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("[BROWSER_URL]")) {
              return trimmed.replace("[BROWSER_URL]", "").trim() || undefined;
          }
      }
      return undefined;
  }

  private static isBrowserApp(appName: string): boolean {
      const name = (appName || '').toLowerCase();
      return [
          'chrome',
          'google chrome',
          'brave',
          'arc',
          'safari',
          'firefox',
          'edge',
          'microsoft edge',
          'opera'
      ].some(token => name.includes(token));
  }

  private static isClaudeDomain(url: string): boolean {
      const raw = (url || '').trim();
      if (!raw) return false;

      const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
          const hostname = new URL(withScheme).hostname.toLowerCase();
          return hostname === 'claude.ai' || hostname.endsWith('.claude.ai');
      } catch {
          const lower = raw.toLowerCase();
          return /(^|\/|\.|:)claude\.ai(\/|$)/i.test(lower);
      }
  }

  private static isChatGPTDomain(url: string): boolean {
      const raw = (url || '').trim();
      if (!raw) return false;

      const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
          const hostname = new URL(withScheme).hostname.toLowerCase();
          return hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com') || hostname === 'chat.openai.com' || hostname.endsWith('.chat.openai.com');
      } catch {
          const lower = raw.toLowerCase();
          return /(^|\/|\.|:)chatgpt\.com(\/|$)/i.test(lower) || /(^|\/|\.|:)chat\.openai\.com(\/|$)/i.test(lower);
      }
  }

  private static async handleVisionCapture(appName: string, title?: string) {
      const isClaudeDesktop = appName.toLowerCase().includes("claude");
      const isBrowser = this.isBrowserApp(appName);
      // Only support Claude desktop or supported browser-based chat domains
      if (!isClaudeDesktop && !isBrowser) return;

      const now = Date.now();
      
      // Debounce
      const titleChanged = title && title !== this.lastTitle;
      if (!titleChanged && (now - this.lastCaptureTime < this.CAPTURE_INTERVAL)) return;

      this.lastCaptureTime = now;
      if (title) this.lastTitle = title;
      
      console.log(`Watcher: Triggering Vision Capture for ${appName} (Title: ${title})`);
      
      // 1. Extract Text First (Code-based Strategy)
      const { scraper } = await import("./scraper");
      let extractedText = "";
      try {
          extractedText = await scraper.getText(appName);
      } catch(e) { console.warn("Text extraction failed", e); }

      // Route by app/domain so each flow is isolated
      if (isClaudeDesktop) {
          await this.handleClaudeDesktopCapture(appName, title, extractedText);
          return;
      }

    const browserUrl = this.extractBrowserUrl(extractedText);
      const isClaudeBrowser = isBrowser && !!browserUrl && this.isClaudeDomain(browserUrl);
      const isChatGPTBrowser = isBrowser && !!browserUrl && this.isChatGPTDomain(browserUrl);

      if (isBrowser && isClaudeBrowser) {
          await this.handleClaudeWebCapture(appName, title, extractedText);
          return;
      }

      if (isBrowser && isChatGPTBrowser) {
          await this.handleChatGPTCapture(appName, title, extractedText);
          return;
      }

      if (isBrowser && !isClaudeBrowser && !isChatGPTBrowser) {
          return;
      }

      // 2. Fallback to Vision LLM if direct parsing failed (e.g. no accessibility classes found)
      console.log("Watcher: Direct parse failed (no semantic tags). Falling back to Vision LLM.");
      
      const imagePath = await vision.captureAppWindow(appName, title);
      
      if (imagePath) {
          try {
              // LLM Fallback Temporarily Disabled to prioritize Direct Parsing reliability
              // const { llm } = await import('./llm');
              // const prompt = `...`;
              
              // For now, simple log
              console.log("Watcher: Vision captured, but LLM extraction path is paused in favor of direct accessibility extraction.");
              
          } catch(e) {
              console.error("Vision Fallback Failed", e);
          }
      }
  }

  private static async handleClaudeDesktopCapture(appName: string, title: string | undefined, extractedText: string) {
      const parsedResult = this.parseClaudeDesktopOutput(extractedText);
      const parsedMessages = parsedResult.messages;
      const chatTitle = parsedResult.chatTitle;

      if (parsedMessages.length > 0) {
          const effectiveTitle = chatTitle || title || "Untitled Chat";
          console.log(`Watcher: Claude Desktop parse success. Found ${parsedMessages.length} messages. Chat: ${effectiveTitle}`);
          await this.saveConversationToDB(appName, effectiveTitle, parsedMessages);
      }
  }

  private static async handleClaudeWebCapture(appName: string, title: string | undefined, extractedText: string) {
      const parsedResult = this.parseClaudeWebOutput(extractedText);
      const parsedMessages = parsedResult.messages;
      const chatTitle = parsedResult.chatTitle;

      if (parsedMessages.length > 0) {
          const effectiveTitle = chatTitle || title || "Untitled Chat";
          console.log(`Watcher: Claude Web parse success. Found ${parsedMessages.length} messages. Chat: ${effectiveTitle}`);
          await this.saveConversationToDB("Claude.ai", effectiveTitle, parsedMessages);
      }
  }

  private static async handleChatGPTCapture(appName: string, title: string | undefined, extractedText: string) {
      const parsedResult = this.parseChatGPTOutput(extractedText);
      const parsedMessages = parsedResult.messages;
      const chatTitle = parsedResult.chatTitle;

      if (parsedMessages.length > 0) {
          const effectiveTitle = chatTitle || title || "Untitled Chat";
          console.log(`Watcher: ChatGPT parse success. Found ${parsedMessages.length} messages. Chat: ${effectiveTitle}`);
          await this.saveConversationToDB("ChatGPT", effectiveTitle, parsedMessages);
      }
  }

  // Refactored Helper - Divergence Point Deduplication
  private static async saveConversationToDB(appName: string, chatTitle: string, messages: { role: string, content: string, timestamp?: string }[]) {
        const db = getDB();

        // Use the passed chatTitle as-is (from [CHAT_TITLE] extraction)
        // "Untitled" is a valid title and will be displayed as-is
        const displayTitle = chatTitle || "Untitled";
        console.log(`Watcher: Using chat title: "${displayTitle}"`);

        // Session ID uses the display title for grouping
        const safeTitle = displayTitle.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase().slice(0, 60);
        const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const sessionId = `${safeAppName}-${safeTitle}`;

        const upsertConv = db.prepare(`
            INSERT INTO conversations (id, title, app_name, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        `);
        upsertConv.run(sessionId, displayTitle, appName);

        // Get existing messages for this conversation (oldest first for comparison)
        const existingMessages = db.prepare(`
            SELECT role, content, timestamp FROM messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC
        `).all(sessionId) as { role: string, content: string, timestamp?: string }[];

        // Create signature for comparison (role + content + optional timestamp)
        const createSignature = (m: { role: string, content: string, timestamp?: string }) => {
            // Include timestamp if available for more precise matching
            const ts = m.timestamp || '';
            return `${m.role.toLowerCase()}|${ts}|${m.content}`;
        };

        // Find divergence point: where do the new messages start differing from existing?
        // Strategy: Find the last existing message in the new messages list
        let insertStartIndex = 0;
        
        if (existingMessages.length > 0) {
            // Get the last stored message's signature
            const lastExisting = existingMessages[existingMessages.length - 1];
            const lastExistingSig = createSignature(lastExisting);
            
            // Search backwards through new messages to find where we left off
            for (let i = messages.length - 1; i >= 0; i--) {
                const newSig = createSignature(messages[i]);
                if (newSig === lastExistingSig) {
                    // Found the match! Start inserting from the next message
                    insertStartIndex = i + 1;
                    break;
                }
            }
            
            // If no match found, check if all messages already exist (full overlap)
            if (insertStartIndex === 0) {
                const existingSet = new Set(existingMessages.map(createSignature));
                // Find first message that doesn't exist
                for (let i = 0; i < messages.length; i++) {
                    if (!existingSet.has(createSignature(messages[i]))) {
                        insertStartIndex = i;
                        break;
                    }
                }
                // If all match, nothing to insert
                if (insertStartIndex === 0 && existingSet.has(createSignature(messages[0]))) {
                    console.log(`Watcher: No new messages to insert for ${sessionId}`);
                    return;
                }
            }
        }

        // Insert only new messages starting from divergence point
        let inserted = 0;
        const insertedMessages: { id: number; role: string; content: string; timestamp?: string | null }[] = [];
        const insertStmt = db.prepare('INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)');

        for (let i = insertStartIndex; i < messages.length; i++) {
            const msg = messages[i];
            const role = msg.role.toLowerCase();
            const text = msg.content;
            const timestamp = msg.timestamp || null;
            if (!text) continue;

            const info = insertStmt.run(sessionId, role, text, timestamp);
            const messageId = Number(info.lastInsertRowid || 0);
            console.log(`Watcher: Saved (${role}) [${timestamp || 'no-time'}]: ${text.substring(0, 30)}...`);
            inserted++;

            if (messageId) {
                insertedMessages.push({ id: messageId, role, content: text, timestamp });
            }
        }
        
        if (inserted > 0) {
            console.log(`Watcher: Inserted ${inserted} new messages for ${sessionId}`);

            // Evaluate messages for memory storage
            if (insertedMessages.length > 0) {
                try {
                    const { evaluateAndStoreMemoryForMessage } = await import('./ipc');
                    await Promise.all(
                        insertedMessages.map((m) =>
                            evaluateAndStoreMemoryForMessage({
                                sessionId,
                                appName,
                                role: m.role,
                                content: m.content,
                                messageId: m.id
                            })
                        )
                    );
                } catch (e) {
                    console.error('Watcher: Memory evaluation failed', e);
                }
            }
            
            // Trigger automatic summarization
            try {
                // Dynamically import to avoid circular dependency issues if any, though static import is preferred if clean.
                // But watcher seems to use dynamic imports for other things. Let's try static first or keep consistent.
                // The watcher class is used in main process so it should be fine.
                // However, ipc.ts imports database, database imports... wait.
                // ipc.ts imports database. watcher imports database.
                // Let's use dynamic import for safety within the method.
                const { summarizeSession } = await import('./ipc');
                summarizeSession(sessionId).catch(err => console.error("Watcher: Auto-summary failed", err));
            } catch (e) {
                console.error("Watcher: Failed to import/run summarization", e);
            }
        }
  }

  static stop() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}
