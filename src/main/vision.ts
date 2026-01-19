import { desktopCapturer, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class VisionService {
    private capturesDir: string;

    constructor() {
        this.capturesDir = path.join(app.getPath('userData'), 'captures');
        if (!fs.existsSync(this.capturesDir)) {
            fs.mkdirSync(this.capturesDir, { recursive: true });
        }
    }

    async captureAppWindow(appName: string, windowTitle?: string): Promise<string | null> {
        try {
            console.log(`Vision: Attempting to capture window for ${appName} (Title: ${windowTitle || 'Any'})...`);
            // Fetch sources - note that 'thumbnailSize' determines the resolution of the screenshot.
            const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1920, height: 1080 } });
            
            let targetSource: Electron.DesktopCapturerSource | undefined = undefined;

            if (windowTitle) {
                // Exact title match is best for the active window
                targetSource = sources.find(s => s.name === windowTitle);
            }

            // Fallback: fuzzy match on title or app name owners
            if (!targetSource) {
                 targetSource = sources.find(s => 
                    s.name.toLowerCase().includes(appName.toLowerCase()) || 
                    (s as any).app?.name?.toLowerCase() === appName.toLowerCase() 
                );
            }

            // Specific fallback for Claude if generics fail (sometimes title is just "Claude" or similar)
            if (!targetSource) {
                 targetSource = sources.find(s => s.name.toLowerCase().includes("claude"));
            }

            if (!targetSource) {
                console.log(`Vision: No window found matching ${appName} / ${windowTitle}`);
                return null;
            }


            // Verify it is likely the right one? 
            // If we matched by title given by the accessibility API, we are reasonably confident.

            const thumbnail = targetSource.thumbnail.toPNG();
            const filename = `capture-${Date.now()}.png`;
            const filePath = path.join(this.capturesDir, filename);
            
            await fs.promises.writeFile(filePath, thumbnail);
            console.log(`Vision: Captured ${filePath}`);
            return filePath;

        } catch (e) {
            console.error("Vision Capture Failed:", e);
            return null;
        }
    }

    cleanup(filePath: string) {
        fs.unlink(filePath, (err) => {
             if (err) console.error("Failed to cleanup capture:", err);
        });
    }
}

export const vision = new VisionService();
