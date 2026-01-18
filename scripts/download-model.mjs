import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/models');
// Using Unsloth repo as it is reliably non-gated for GGUFs
const MODEL_URL = "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf";
const MODEL_FILENAME = "qwen2.5-vl-3b-instruct-q4_k_m.gguf";
const DEST_PATH = path.join(RESOURCES_DIR, MODEL_FILENAME);

if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

if (fs.existsSync(DEST_PATH)) {
    console.log(`Model already exists at ${DEST_PATH}`);
    process.exit(0);
}

console.log(`Downloading model from ${MODEL_URL} to ${DEST_PATH}...`);

const file = fs.createWriteStream(DEST_PATH);

https.get(MODEL_URL, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirect
        console.log(`Redirecting to ${response.headers.location}...`);
        https.get(response.headers.location, (redirectResponse) => {
             downloadStream(redirectResponse, file);
        });
        return;
    }
    
    downloadStream(response, file);

}).on('error', (err) => {
    fs.unlink(DEST_PATH, () => {}); // Delete partial file
    console.error("Download failed:", err.message);
    process.exit(1);
});

function downloadStream(response, fileStream) {
    if (response.statusCode !== 200) {
        console.error(`Failed to download: HTTP Status ${response.statusCode}`);
        // Read some of the body to see why (e.g. error message)
        response.setEncoding('utf8');
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
            console.error("Response body:", data.slice(0, 200)); 
            fs.unlink(DEST_PATH, () => {});
            process.exit(1);
        });
        return;
    }

    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloaded = 0;

    response.pipe(fileStream);

    response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
            const percent = ((downloaded / totalSize) * 100).toFixed(2);
            process.stdout.write(`\rDownloading: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
        } else {
             process.stdout.write(`\rDownloading: ${(downloaded / 1024 / 1024).toFixed(2)} MB`);
        }
    });

    fileStream.on('finish', () => {
        fileStream.close();
        console.log("\nDownload complete!");
    });
}
