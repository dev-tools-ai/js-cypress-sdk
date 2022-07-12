import { defineConfig } from 'cypress';
import { task } from './task';

import 'dotenv/config';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // bind to the event we care about
      task.register(on);
      return config;
    },
    env: {
      interactiveMode: true,
    },
  },
  watchForFileChanges: true,
  chromeWebSecurity: false,
});
