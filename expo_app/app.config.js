const fs = require('fs');
const path = require('path');

const appJson = require('./app.json').expo;

const configPath = path.resolve(__dirname, '..', 'config.yaml');

const readSharedApiConfig = () => {
  try {
    const lines = fs.readFileSync(configPath, 'utf8').split(/\r?\n/);
    let currentSection = null;
    const apiConfig = {};

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) {
        continue;
      }

      if (!/^\s/.test(line)) {
        currentSection = line.replace(/:\s*$/, '').trim();
        continue;
      }

      if (currentSection !== 'api') {
        continue;
      }

      const hostMatch = line.match(/^\s+host:\s*"?([^"\n]+)"?\s*$/);
      if (hostMatch) {
        apiConfig.host = hostMatch[1].trim();
        continue;
      }

      const portMatch = line.match(/^\s+port:\s*(\d+)\s*$/);
      if (portMatch) {
        apiConfig.port = portMatch[1];
      }
    }

    return apiConfig;
  } catch {
    return {};
  }
};

const sharedApiConfig = readSharedApiConfig();

module.exports = {
  ...appJson,
  extra: {
    ...appJson.extra,
    apiPort: sharedApiConfig.port || appJson.extra?.apiPort || '8000',
  },
};