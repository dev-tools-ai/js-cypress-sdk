[![dev-tools.ai sdk logo](https://dev-tools.ai/img/logo.svg)](https://dev-tools.ai/)

[![npm version](https://badge.fury.io/js/@devtools-ai%2Fcypress-sdk.svg)](https://badge.fury.io/js/@devtools-ai%2Fcypress-sdk)

### Installation

Installation is simple. First add and install the package in your project.

#### Cypress 10

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

Then in your `cypress.config.ts` or `cypress.config.js` file. Import the plugin tasks and disable chromeWebSecurity.

```js
import { defineConfig } from 'cypress';
import { registerSmartDriverTasks } from '@devtools-ai/cypress-sdk/dist/plugins';
export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      registerSmartDriverTasks(on, config);
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

#### Cypress 9

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

Then in your `plugins/index.js` file. Import the plugin tasks and disable chromeWebSecurity in `cypress.json` file.

```js
// plugins/index.js
const {
  registerSmartDriverTasks,
} = require('@devtools-ai/cypress-sdk/dist/plugins');

module.exports = (on, config) => {
  registerSmartDriverTasks(on, config);
  return config;
};
```

`cypress.json`

```json
{
  "chromeWebSecurity": false
}
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

You may also want to enable to interactive mode. Interactive mode pauses the test so you can enter bounding boxes for test elements. These boxes only need to be added once during initial detection. You can enable this mode by exporting this environment variable and setting to true :

```
export DEVTOOLSAI_INTERACTIVE=TRUE
```

You can add this in the `cypress.config.ts` file.

```js
export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // bind to the event we care about
      registerSmartDriverTasks(on, config);
      return config;
    },
    env: {
      DEVTOOLSAI_INTERACTIVE: true,
    },
  },
  watchForFileChanges: true,
  chromeWebSecurity: false,
});
```

You can also add it to your `.env` file to avoid committing it.

```
 DEVTOOLSAI_INTERACTIVE=true
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

### Tutorial

We have a detailed step-by-step tutorial to help you get set up with the SDK: https://dev-tools.ai/docs/category/tutorial---cypressio
