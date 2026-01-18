import { app, shell, BrowserWindow, systemPreferences } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setupIPC } from './ipc' // IMPORT FROM IPC ONLY
import { Watcher } from './watcher'

// FORCE UPDATE VERIFICATION: 3 - SHELL OVERWRITE
console.log("MAIN PROCESS: LOADING CUSTOM ENTRY POINT (SHELL OVERWRITE)");

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, // REQUIRED for IPC
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  console.log("APP READY: Initializing Services...");

  // Trigger permission prompt if not trusted
  if (process.platform === 'darwin') {
      const trusted = systemPreferences.isTrustedAccessibilityClient(true);
      console.log("Accessibility Permission:", trusted ? "Granted" : "Denied/Prompted");
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })



  // 2. Setup IPC Handlers
  try {
     setupIPC();
     console.log("IPC Handlers Registered.");
  } catch (e) {
     console.error("FATAL: IPC Setup failed", e);
  }

  // 3. Start Watcher
  try {
    Watcher.start();
    console.log("Watcher Service Started.");
  } catch (e) {
    console.error("Watcher Start Failed", e);
  }

  // 4. Initialize LLM (Async)
  // We don't await this to avoid blocking window creation
  import('./llm').then(({ llm }) => {
      llm.init().catch(err => console.error("Failed to init LLM:", err));
  });

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
