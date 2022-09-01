/* eslint-disable camelcase */
import { createCypressEnvVariable, getSDKConfigFromFile } from './src/utils';
import { createSDK } from '@devtools-ai/js-sdk';
import 'dotenv/config';
import open from 'open';
import { sync } from 'fast-glob';
import { readFileSync, unlinkSync } from 'fs';
export const task = {
  register(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
    on('task', {
      openClassifyTab: task.openClassifyTab,
      readScreenshot: task.readScreenshot,
      cleanupImages: task.cleanupImages,
    });
    // add some environment variables we care about
    // config is passed by reference
    if (config) {
      config.env = config.env || {};
      config.env.interactiveMode =
        config.env.interactiveMode ||
        process.env.interactiveMode?.toLocaleLowerCase() === 'true' ||
        process.env.DEVTOOLSAI_INTERACTIVE?.toLocaleLowerCase() === 'true' ||
        process.env.DEVTOOLSAI_INTERACTIVE?.toLocaleLowerCase() === '1';
    }
    const configFile = getSDKConfigFromFile();
    Object.keys(configFile).forEach((configKey) => {
      // save the config variable to cypress config
      const smartDriverEnvName = createCypressEnvVariable(configKey);
      config.env[smartDriverEnvName] = configFile[configKey];
    });
  },

  createPingEvent(testCaseName: string) {
    const config = this.getSDKConfig();
    const client = createSDK(config);
    client.createCheckIn(testCaseName);
    return null;
  },

  async openClassifyTab(url: string) {
    await open(url);
    return null;
  },

  cleanupImages() {
    return new Promise((resolve, reject) => {
      const entries = sync('cypress/**/temp-devtools-*.png', {
        onlyFiles: true,
      });
      for (const entry of entries) {
        try {
          unlinkSync(entry);
        } catch (e) {
          reject('Error deleting temp image' + entry);
        }
      }
      resolve(entries);
    });
  },
  readScreenshot(fileName: string) {
    // use glob to try to find the file
    // cypress/**/${fileName}.{png}

    return new Promise((resolve, reject) => {
      const entries = sync(`cypress/**/${fileName}*.png`, {
        onlyFiles: true,
      });
      if (!entries.length) {
        reject(`Couldn't find a screenshot with the file name: ${fileName}`);
      }
      const filePath = entries[0];
      try {
        const data = readFileSync(filePath, { encoding: 'base64' });
        resolve(data);
      } catch (e) {
        reject(`Couldn't read the screenshot: ${filePath}`);
      }
    });
  },
};
