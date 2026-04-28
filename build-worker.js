const fs = require("fs");
const path = require("path");

console.log("[build-worker.js] Using src/index.ts as the unified Wrapper Worker.");

// Ensure wrangler.jsonc points to src/index.ts so Wrangler bundles everything
const wranglerPath = path.join(__dirname, "wrangler.jsonc");
if (fs.existsSync(wranglerPath)) {
  let wranglerContent = fs.readFileSync(wranglerPath, "utf8");
  const mainRegex = /"main":\s*"[^"]+"/;

  if (mainRegex.test(wranglerContent)) {
    const newWranglerContent = wranglerContent.replace(mainRegex, `"main": "src/index.ts"`);
    if (newWranglerContent !== wranglerContent) {
      fs.writeFileSync(wranglerPath, newWranglerContent);
      console.log(`[build-worker.js] Updated wrangler.jsonc main path to: src/index.ts`);
    } else {
      console.log(`[build-worker.js] wrangler.jsonc main path is already correct.`);
    }
  } else {
    console.warn('[build-worker.js] WARNING: Could not find "main" field in wrangler.jsonc');
  }
}

console.log("[build-worker.js] Build configuration check complete.");
