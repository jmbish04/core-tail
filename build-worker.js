const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'dist/_worker.js/index.js');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('export { LogAnalyzerAgent }')) {
  content += '\nexport { LogAnalyzerAgent } from "../../src/backend/agent.ts";\n';
  fs.writeFileSync(file, content);
}
