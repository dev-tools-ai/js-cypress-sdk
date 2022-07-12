/* eslint-disable camelcase */
import { getDevToolsAiConfig } from './src/utils';
import 'dotenv/config';
import open from 'open';
export const task = {
  register(on: Cypress.PluginEvents) {
    on('task', {
      getSDKConfig: task.getSDKConfig,
      openClassifyTab: task.openClassifyTab,
      log(message: string) {
        console.log(message);
        return null;
      },
    });
  },
  getSDKConfig() {
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
  },
  async openClassifyTab(url: string) {
    await open(url);
    return null;
  },
};
