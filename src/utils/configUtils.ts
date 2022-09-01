import type { createSDKOptions } from '@devtools-ai/js-sdk';
import { existsSync } from 'fs';
import { resolve } from 'path';

const CONFIG_ENV_VAR_NAME = 'DEVTOOLSAI_';

const CONFIG_FILE_NAME = 'smartdriver.config';

/**
 * Get the the configuration file from the project root as a JSON object.
 * The name of the file must be 'devToolsAI.config.ts' or 'devToolsAI.config.js'.
 * This can only be used in an node.js environment. This cannot be run in a browser.
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
    // eslint-disable-next-line no-console
    console.error('DevToolsAI: Error reading configuration file:' + e);
    return null;
  }
  return config as Partial<createSDKOptions>;
};

export const getSDKConfigFromFile = () => {
  const configFile = getDevToolsAiConfig();
  if (!configFile) {
    throw new Error(
      'No SmartDriver config file found. Please include a file named "smartdriver.config.js" in the root of your project.',
    );
  }
  if (!configFile || !configFile?.apiKey?.length) {
    throw new Error(
      'Please include the SmartDriver API key in your smartdriver.config.js file',
    );
  }
  return configFile;
};

export const createCypressEnvVariable = (variableName) =>
  `${CONFIG_ENV_VAR_NAME}${variableName}`;

export const getDevToolsConfigVariable = (variableName: string) => {
  return Cypress.env(createCypressEnvVariable(variableName));
};

/**
 * Gets the user set DevTools JS sdk settings from the Cypress env variables
 * Usage: const sdkConfig = getSDKConfigFromCypress();
 * @returns
 */
export const getSDKConfigFromCypress = () => {
  const envVars = Cypress.env();
  const allKeys = Object.keys(Cypress.env());
  let configObj = {};
  allKeys
    .filter((val) => val.startsWith(CONFIG_ENV_VAR_NAME))
    .forEach((key) => {
      configObj = {
        ...configObj,
        ...{ [key.replace(CONFIG_ENV_VAR_NAME, '')]: envVars[key] },
      };
    });
  return configObj;
};
