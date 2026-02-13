// Run react-scripts build with REACT_APP_ secrets removed from env so they never get into the bundle.
// Use: node build-with-clean-env.js (called from npm run build)

const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const SECRET_KEYS = [
  'REACT_APP_ZEGO_APP_ID',
  'REACT_APP_ZEGO_SERVER_SECRET',
  'REACT_APP_DECRYPTION_KEY'
];

const env = { ...process.env };
SECRET_KEYS.forEach(key => delete env[key]);

const buildScript = path.join(__dirname, 'node_modules', 'react-scripts', 'scripts', 'build.js');
const result = spawnSync(
  process.execPath,
  [buildScript],
  {
    stdio: 'inherit',
    env,
    cwd: __dirname
  }
);

process.exit(result.status !== null ? result.status : 1);
