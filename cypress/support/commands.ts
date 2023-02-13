/// <reference types="cypress"/>
/* eslint-disable camelcase */
import type { testEntityModel } from '@devtools-ai/js-sdk';
import {
  matchBoundingBoxToCypressElement,
  SmartDriverManager,
  getSmartDriverClient,
  createTestElementFromDOMRect,
  getElementRectangle,
  generateImageUUID,
} from '../../src/utils';

const currentCommandQueue: Array<'get' | 'find'> = [];
const timerStack: NodeJS.Timer[] = [];

const SCREENSHOT_FILE_NAME = 'temp';

const testManager = new SmartDriverManager();

before(() => {
  const testName = Cypress.currentTest.title;
  // Before we run our tests, create a check in for analytics
  // Mute Cypress logs to not spam the log with action

  getSmartDriverClient().createCheckIn(testName);
});

after(() => {
  // Clean up screenshots we have taken
  cy.task('cleanupImages', null, { log: false });
});

/**
 * Return if the user wants to user interactive mode which
 * requires the user to manually classify the element.
 * @returns
 */
const inInteractiveMode = () => Cypress.env('interactiveMode') === true;

/**
 * Using the selector provided, tries to find an html element
 * using the previous screenshots provided and AI training.
 * Example: cy.getByAI("#my-element").isVisible()
 *
 * @param selector
 * @returns
 */
function getByAI(selector: string) {
  const testName = Cypress.currentTest.title;
  const client = getSmartDriverClient();
  const screenshotFileName = generateImageUUID();
  const eventId = (Math.random() + 1).toString(36).substring(2);

  // used only when we fail to get an element normally
  cy.then(() => {
    let currentScreenshot = '';
    return cy
      .screenshot(screenshotFileName, {
        overwrite: true,
        capture: 'viewport',
      })
      .task('readScreenshot', screenshotFileName)
      .then((screenshotBase64) => {
        const b64Hash = testManager.setTestScreenshot(
          screenshotFileName,
          screenshotBase64,
        );
        currentScreenshot = screenshotBase64;
        return client.getIfScreenshotExists(b64Hash, selector);
      })
      .then(({ screenshot_exists, predicted_element }) => {
        if (screenshot_exists) return predicted_element;
        return new Cypress.Promise<null>(async (resolve) => {
          try {
            await client.uploadTestElementScreenshot(
              currentScreenshot,
              selector,
              testName,
            );
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        });
      })
      .then((possibleEl) => {
        const predicted_element = possibleEl;
        if (!predicted_element) {
          const { screenshotUuid } =
            testManager.getTestCaseScreenshotInformation(screenshotFileName);
          return new Cypress.Promise<{
            predicted_element: testEntityModel | null;
          }>(async (resolve) => {
            const { predicted_element, success } = await client.getTestCaseBox(
              selector,
              screenshotUuid,
              testName,
              false,
              eventId,
            );
            if (!predicted_element || !success) {
              resolve({ predicted_element: null });
            }
            resolve({ predicted_element });
          });
        }
        return { predicted_element };
      })
      .then((element) => {
        const { predicted_element } = element as unknown as {
          predicted_element: testEntityModel;
        } | null;
        if (!predicted_element) return findByAI(selector);
        return matchBoundingBoxToCypressElement(predicted_element);
      });
  });
}

/**
 * Call the 'detect' API and checks if there is a model for it
 * already. If there is no model, asks the user to add a bounding
 * box on the web app by opening their default browser. At the end,
 * returns an element most closely matched to that model.
 * @param selector
 */
const findByAI = (selector: string) => {
  const testName = Cypress.currentTest.title;
  const eventId = (Math.random() + 1).toString(36).substring(2);
  // If we have the model, look for the closest match
  // If there is no match, cypress will automatically
  // fail the test.

  const errorMessage =
    'Boundary box was never received. Please visit https://smartdriver.dev-tools.ai/ to classify your element';

  // Time length is in ms, minutes * seconds * ms
  const timeoutLength = 100 * 60 * 1000; // 100 minutes

  const getSecondsElapsed = (start: number) => {
    return Date.now() - start;
  };
  const client = getSmartDriverClient();
  const screenshotFileName = generateImageUUID();

  if (inInteractiveMode()) {
    cy.screenshot(screenshotFileName, {
      overwrite: true,
      capture: 'viewport',
    })
      .task('readScreenshot', screenshotFileName)
      .then({ timeout: timeoutLength }, (b64screenshot) => {
        return new Cypress.Promise<string>(async (resolve, _) => {
          await client.uploadTestElementScreenshot(
            b64screenshot,
            selector,
            testName,
          );
          // in interactive mode we upload with interactive: true which guarantees we will have the screenshot
          resolve(b64screenshot);
        });
      })
      .then({ timeout: timeoutLength }, (b64screenshot) => {
        // Save our screenshot data
        // Then try to get the element box
        const screenshotUuid = testManager.setTestScreenshot(
          screenshotFileName,
          b64screenshot,
        );
        cy.log('SmartDriver: Retrieving element 🔧');
        return new Cypress.Promise<Cypress.Chainable<
          JQuery<HTMLElement>
        > | null>(async (resolve, reject) => {
          // try to get the element box first
          try {
            const { predicted_element } = await client.getTestCaseBox(
              selector,
              screenshotUuid,
              testName,
              false,
              eventId,
            );
            if (!predicted_element) {
              resolve(null);
            }
            resolve(matchBoundingBoxToCypressElement(predicted_element));
          } catch (error) {
            // No box found, we can resolve this for now
            reject(error);
          }
        });
      })
      .then({ timeout: timeoutLength }, (elementFound) => {
        if (!elementFound) {
          // There is no boundary box yet, wait for user to draw it in
          // wait for user to draw in element
          const labelUrl = encodeURI(
            `https://smartdriver.dev-tools.ai/testcase/label?test_case_name=${Cypress.currentTest.title}`,
          );
          cy.task('openClassifyTab', labelUrl)
            .then({ timeout: timeoutLength }, () => {
              const startTime = Date.now();
              let elementClassified = false;
              return new Cypress.Promise<
                Cypress.Chainable<JQuery<HTMLElement>>
              >((resolve, reject) => {
                // wait for the element to be classified

                const timeoutWithBuffer = timeoutLength * 0.95;
                const timerId = setInterval(async () => {
                  try {
                    const { screenshotUuid } =
                      testManager.getTestCaseScreenshotInformation(
                        screenshotFileName,
                      );
                    const { predicted_element } =
                      await window.smartDriverClient.getTestCaseBox(
                        selector,
                        screenshotUuid,
                        testName,
                        false,
                        eventId,
                      );
                    if (predicted_element) {
                      elementClassified = true;
                      clearInterval(timerId);
                      return resolve(
                        matchBoundingBoxToCypressElement(predicted_element),
                      );
                    }
                    const currentTime = getSecondsElapsed(startTime);
                    if (currentTime > timeoutWithBuffer) {
                      clearInterval(timerId);
                      return reject(new Error(errorMessage));
                    }
                  } catch (e) {
                    clearInterval(timerId);

                    throw e;
                  }
                }, 2000);
                timerStack.push(timerId);
                (function pollBoundaryBox() {
                  // continue polling until user enters the
                  // bounding box
                  if (elementClassified) {
                    return resolve();
                  }

                  const currentTime = getSecondsElapsed(startTime);
                  const timeoutWithBuffer = timeoutLength * 0.45;
                  if (currentTime > timeoutWithBuffer) {
                    clearInterval(timerId);
                    return reject(new Error(errorMessage));
                  }
                  setTimeout(pollBoundaryBox, timeoutLength);
                })();
              });
            })
            .then((elem) => {
              return elem;
            });
        } else {
          // Element boundary box was successfully grabbed
          // return to be used
          return elementFound;
        }
      });
  } else {
    let currentScreenshot = '';
    cy.screenshot(screenshotFileName, { overwrite: true })
      .task('readScreenshot', screenshotFileName)
      .then((b64screenshot) => {
        currentScreenshot = b64screenshot;
        const b64Hash = testManager.setTestScreenshot(
          screenshotFileName,
          b64screenshot,
        );
        return client.getIfScreenshotExists(b64Hash, selector);
      })
      .then(({ success, predicted_element }) => {
        if (success && predicted_element) {
          return matchBoundingBoxToCypressElement(predicted_element);
        } else {
          return new Cypress.Promise(async (resolve, reject) => {
            try {
              const { success, message, predicted_element } =
                await client.classifyObject(
                  currentScreenshot,
                  '',
                  selector,
                  testName,
                );

              if (!success) {
                reject(message);
              }
              resolve(matchBoundingBoxToCypressElement(predicted_element));
            } catch (e) {
              reject(e);
            }
          });
        }
      });
  }
};

Cypress.Commands.add('findByAI', findByAI);
Cypress.Commands.add('getByAI', getByAI);

Cypress.on('test:before:run', () => {
  // Reset our run
  currentCommandQueue.splice(0, currentCommandQueue.length);
});

Cypress.on('fail', (err) => {
  // Just in case a promise fails, reenable this

  testManager.createFailState();
  const { name } = err;
  timerStack.forEach((val) => clearInterval(val));

  if (name === 'AxiosError') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  throw err;
});
/*
* DISABLING OVERWRITE COMMANDS DUE TO ISSUE IN CYPRESS 12
*   - https://github.com/cypress-io/cypress/issues/25078
*

Cypress.Commands.overwrite(
  'find',
  (originalFn, previousElement, findSelector) => {
    currentCommandQueue.push('find');
    //@ts-expect-error findSelector is mapped to the wrong type
    testManager.addCommandToStack(findSelector, 'find');
    //@ts-expect-error findSelector is mapped to the wrong type
    testManager.cacheSelector(findSelector);
    if (
      testManager.getIsInBackupMode() ||
      //@ts-expect-error this is actually the string given into the find function
      testManager.getShouldUseAI(findSelector)
    ) {
      testManager.resetCurrentMode();
      //@ts-expect-error this is actually the string given into the find function

      return findByAI(findSelector);
    }

    return originalFn(previousElement, findSelector);
  },
);

Cypress.Commands.overwrite('get', (originalFn, selector: string, options) => {
  const testName = Cypress.currentTest.title;

  if (selector.includes(':cy-')) {
    // we don't ingest these yet. These are chained commands
    return originalFn(selector, options);
  }

  testManager.addCommandToStack(selector, 'get');
  if (testManager.getIsInBackupMode() || testManager.getShouldUseAI(selector)) {
    testManager.resetCurrentMode();
    return findByAI(selector);
  }

  // If the element is found as normal,
  // upload the screenshot if it isn't frozen,
  // add the model found,
  // return the element

  const getWithAutoIngest = (selector, options) => {
    const client = getSmartDriverClient();
    let currentScreenshot = '';
    const screenshotFileName = generateImageUUID();

    cy.then(() => {
      return client.getIfFrozen(selector);
    }).then(({ is_frozen }) => {
      if (is_frozen) return originalFn(selector, options);
      return cy
        .screenshot(SCREENSHOT_FILE_NAME, {
          overwrite: true,
          capture: 'viewport',
        })
        .task('readScreenshot', screenshotFileName)
        .then((b64screenshot) => {
          currentScreenshot = b64screenshot;
          const screeenshothash = testManager.setTestScreenshot(
            SCREENSHOT_FILE_NAME,
            b64screenshot,
          );
          return client.getIfScreenshotExists(screeenshothash, selector);
        })
        .then(({ screenshot_exists }) => {
          return screenshot_exists
            ? null
            : client.uploadTestElementScreenshot(
                currentScreenshot,
                selector,
                testName,
              );
        })
        .then(() => {
          return originalFn(selector, options);
        })
        .then((el) => {
          return getElementRectangle(el as JQuery<HTMLElement>);
        })
        .then((rect) => {
          const element = createTestElementFromDOMRect(rect);
          const { screenshotUuid } =
            testManager.getTestCaseScreenshotInformation(SCREENSHOT_FILE_NAME);
          return client.updateTestElement(
            element,
            screenshotUuid,
            selector,
            testName,
          );
        })
        .then(() => {
          return originalFn(selector, options);
        });
    });
  };
  return getWithAutoIngest(selector, options);
});
*/