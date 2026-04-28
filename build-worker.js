const fs = require("fs");
const path = require("path");

// Detect if _worker.js is a file or a directory
const workerPath = path.join(__dirname, "dist/_worker.js");
const workerDirPath = path.join(__dirname, "dist/_worker.js/index.js");

let targetFile;
let workerIsDirectory = false;

// Check if it's a directory with index.js
if (fs.existsSync(workerDirPath) && fs.statSync(workerDirPath).isFile()) {
  targetFile = workerDirPath;
  workerIsDirectory = true;
  console.log("[build-worker.js] Detected directory structure: dist/_worker.js/index.js");
} else if (fs.existsSync(workerPath) && fs.statSync(workerPath).isFile()) {
  targetFile = workerPath;
  console.log("[build-worker.js] Detected single file structure: dist/_worker.js");
} else {
  console.error(
    "[build-worker.js] ERROR: Could not find worker file at dist/_worker.js or dist/_worker.js/index.js",
  );
  process.exit(1);
}

// Read the worker file
let content = fs.readFileSync(targetFile, "utf8");

// Check if Durable Object exports are already present
const hasLogAnalyzer = content.includes("export { LogAnalyzerAgent }");
const hasLogStreamer = content.includes("export { LogStreamer }");

let modified = false;

// Add LogAnalyzerAgent export if missing
if (!hasLogAnalyzer) {
  console.log("[build-worker.js] Adding LogAnalyzerAgent export");
  content += '\nexport { LogAnalyzerAgent } from "../../src/backend/agent";\n';
  modified = true;
}

// Add LogStreamer export if missing
if (!hasLogStreamer) {
  console.log("[build-worker.js] Adding LogStreamer export");
  content += 'export { LogStreamer } from "../../src/backend/do/LogStreamer";\n';
  modified = true;
}

// Write back if modified
if (modified) {
  fs.writeFileSync(targetFile, content);
  console.log("[build-worker.js] Successfully patched worker file with Durable Object exports");
} else {
  console.log("[build-worker.js] Worker file already contains required exports");
}

// Update wrangler.jsonc to point to the correct main file
const wranglerPath = path.join(__dirname, "wrangler.jsonc");
let wranglerContent = fs.readFileSync(wranglerPath, "utf8");

const correctMainPath = workerIsDirectory ? "dist/_worker.js/index.js" : "dist/_worker.js";
const mainRegex = /"main":\s*"[^"]+"/;

if (mainRegex.test(wranglerContent)) {
  const newWranglerContent = wranglerContent.replace(mainRegex, `"main": "${correctMainPath}"`);
  if (newWranglerContent !== wranglerContent) {
    fs.writeFileSync(wranglerPath, newWranglerContent);
    console.log(`[build-worker.js] Updated wrangler.jsonc main path to: ${correctMainPath}`);
  }
} else {
  console.warn('[build-worker.js] WARNING: Could not find "main" field in wrangler.jsonc');
}

console.log("[build-worker.js] Build worker patching complete");
