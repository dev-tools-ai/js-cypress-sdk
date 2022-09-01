import type { DevToolsAiSDK } from '@devtools-ai/js-sdk';
declare global {
  interface Window {
    smartDriverClient: undefined | DevToolsAiSDK;
  }
  namespace Cypress {
    interface Chainable {
      /**
       * Using the selector provided, tries to find an html element
       * using the previous screenshots provided and AI training.
       * Example: cy.getByAI("#my-element").isVisible()
       *
       * @param selector
       * @returns
       */
      getByAI(selector: string): Chainable<JQuery<HTMLElement> | null>;

      /**
       * Using the human readable name provided, tries to find an html element
       * using AI and provided bounding boxes.
       * Example: cy.findByAI("username input").isVisible()
       *
       * @param selector
       * @returns
       */
      findByAI(selector: string): Chainable<JQuery<HTMLElement> | null>;
      task(command: 'readScreenshot', fileName: string): Chainable<string>;
    }
  }
}
