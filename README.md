### Installation

Installation is simple. First add and install the package in your project.

```sh
npm install --save @devtools-ai/cypress-sdk -D
```

```sh
yarn add @devtools-ai/cypress-sdk --dev
```

Then add to your `cypress/support/index.js`

```js
import '@devtools-ai/cypress-sdk';
```

Then in your `cypress.config.ts` or `cypress.config.js`. Import the plugin tasks and disable chromeWebSecurity.

```js
import { defineConfig } from 'cypress';
import { registerSmartDriverTasks } from '@devtools-ai/cypress-sdk/dist/plugins';
export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      registerSmartDriverTasks(on);
      // implement node event listeners here
      return config;
    },
  },
  chromeWebSecurity: false,
});
```

Lastly, whenever you want to have the plugin enabled, allow for at least 1 retry for the test written. This allows the plugin to attempt getting the element once the test has failed getting the element normally.

```js
describe('Should be able to login', () => {
  it(
    'Login',
    {
      retries: {
        // SmartDriver is used on the retries
        openMode: 3,
      },
    },
    () => {
      cy.visit('http://www.github.com/login');
      cy.get('login-box').type('mysampleemail@gmail.com');
    },
  );
});
```

Done! 🎉

### Setting up the plugin

To get started, create a file in your project root folder called `smartdriver.config.js`. Then add your API key in it:

```js
module.exports = {
  apiKey: 'YOUR_API_KEY_HERE',
};
```

This file may also contain any options for the [JS sdk](https://www.npmjs.com/package/@devtools-ai/js-sdk).

### Interactive Mode

You may also want to enable to interactive mode. Interactive mode pauses the test so you can enter bounding boxes for test elements. These boxes only need to be added once during initial detection. You can do so by adding an env variable called

```
interactiveMode
```

You can add this in the `cypress.config.ts` file.

```js
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
```

### Sample usage

The SmartDriver will automatically kick in once getting an element fails. This applies for the "get" and "find" cypress commands.

```js
cy.get('[name="login"]').type(username);
```

There is also a unique command, `findByAI`, that allows you to use human readable names instead of relying on selectors.

```js
cy.findByAI('username-input-field').type(username);
```
