// Post-build check: fail if built JS contains server-only secret keys (VAPT).
// Run after build; also: npm run check-bundle

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'build', 'static', 'js');
const FORBIDDEN = [
  'REACT_APP_ZEGO_SERVER_SECRET',
  'REACT_APP_ZEGO_APP_ID',
  'REACT_APP_DECRYPTION_KEY'
];

if (!fs.existsSync(BUILD_DIR)) {
  console.error('Build folder not found. Run npm run build first.');
  process.exit(1);
}

const files = fs.readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));
const found = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(BUILD_DIR, file), 'utf8');
  for (const key of FORBIDDEN) {
    if (content.includes(key)) {
      found.push({ file, key });
    }
  }
}

if (found.length > 0) {
  console.error('SECURITY: Built bundle must not contain server-only secrets.\n');
  found.forEach(({ file, key }) => console.error(`  ${file} contains: ${key}`));
  console.error('\nEnsure build runs with clean env (use npm run build, not build:raw with root .env loaded).\n');
  process.exit(1);
}

console.log('Bundle check passed: no server secrets in built JS.\n');
