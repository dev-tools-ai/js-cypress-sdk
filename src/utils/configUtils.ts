import type { createSDKOptions } from '@devtools-ai/js-sdk';
import { existsSync } from 'fs';
import { resolve } from 'path';
const CONFIG_FILE_NAME = 'smartdriver.config';

/**
 * Get the the configuration file from the project root as a JSON object.
 * The name of the file must be 'devToolsAI.config.ts' or 'devToolsAI.config.js'.
 * @returns createSDKOptions
 */
export const getDevToolsAiConfig = () => {
  const baseDir = process.cwd();
  let configFilePath = '';

  configFilePath = resolve(baseDir, `${CONFIG_FILE_NAME}.ts`);
  if (
    !existsSync(configFilePath) &&
    existsSync(resolve(baseDir, `${CONFIG_FILE_NAME}.js`))
  ) {
    // The file is a JS file
    configFilePath = resolve(baseDir, `${CONFIG_FILE_NAME}.js`);
  } else {
    // Use the default config file
    return null;
  }

  let config = {};
  try {
    const configModuleCache = require.cache[configFilePath];
    delete require.cache[configFilePath];
    config = { ...require(configFilePath) } as Partial<createSDKOptions>;
    require.cache[configFilePath] = configModuleCache;
  } catch (e) {
    console.error('DevToolsAI: Error reading configuration file:' + e);
    return null;
  }
  return config as Partial<createSDKOptions>;
};
