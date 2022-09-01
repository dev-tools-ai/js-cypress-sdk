import { defineConfig } from 'cypress';
import { task } from './task';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // bind to the event we care about
      task.register(on, config);

      return config;
    },
  },
  watchForFileChanges: true,
  chromeWebSecurity: false,
});
