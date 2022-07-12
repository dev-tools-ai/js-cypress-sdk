/// <reference types="cypress"/>
type overriddenCommands = 'get' | 'find';
const currentCommandQueue: overriddenCommands[] = [];

let manualDetectMode = false;
let currentDetectLink = '';

/* eslint-disable camelcase */
import { createSDK } from '@devtools-ai/js-sdk';
import type { DevToolsAiSDK, createSDKOptions } from '@devtools-ai/js-sdk';
import {
  getScreenshotHash,
  matchBoundingBoxToCypressElement,
  SmartDriverManager,
} from '../../src/utils';

const SmartDriver = new SmartDriverManager();

function getSmartDriverClient() {
  if (window.smartDriverClient) return cy.wrap(window.smartDriverClient);
  return cy.task('getSDKConfig').then((config) => {
    const client = createSDK({
      ...(config as createSDKOptions),
      screenMultiplier: window.devicePixelRatio,
    });
    window.smartDriverClient = client;

    return window.smartDriverClient;
  });
}

/**
 * Return if the user wants to user interactive mode which
 * requires the user to manually classify the element.
 * @returns
 */
function inInteractiveMode() {
  return Cypress.env('interactiveMode') === true;
}

/**
 * Returns the true screenshot file name
 * @param fileName
 * @returns
 */
function getScreenshotFilePath(fileName: string) {
  // Cypress appends the attempt to the end of files,
  // This throws off our attempts to read files.
  // We will get the true screenshot name

  // Remove the extension just in case
  const parsedName = fileName.replace('.png', '');
  // @ts-expect-error We are accessing the internal runner. Not in types
  const attemptNumber = cy.state('runnable')._currentRetry + 1;
  if (attemptNumber > 1) {
    return `cypress/screenshots/${parsedName} (attempt ${attemptNumber}).png`;
  }
  return `cypress/screenshots/${parsedName}.png`;
}

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

  // used only when we fail to get an element normally
  return getSmartDriverClient().then((client) => {
    cy.log('SmartDriver: Getting element by AI')
      .then(() => {
        // Get the screenshot
        return cy
          .screenshot('temp', { overwrite: true, capture: 'viewport' })
          .readFile(getScreenshotFilePath('temp'), 'base64');
      })
      .then((screenshotBase64: string) => {
        // Get the element Bounding Box
        const b64Hash = getScreenshotHash(screenshotBase64);
        SmartDriver.setTestScreenshot({
          screenshotFileName: 'temp',
          screenshotUuid: b64Hash,
        });
        return client
          .getIfScreenshotExists(b64Hash, selector)
          .then(({ screenshot_exists, predicted_element }) => {
            if (screenshot_exists) {
              if (!predicted_element) {
                return null;
              }
              return predicted_element;
            } else {
              // screenshot does not exist
              // upload it and try again
              return client
                .uploadTestElementScreenshot(
                  screenshotBase64,
                  selector,
                  testName,
                )
                .then(({ screenshot_uuid }) => {
                  return client.getTestCaseBox(
                    selector,
                    screenshot_uuid,
                    false,
                  );
                })
                .then(({ predicted_element }) => {
                  return predicted_element;
                });
            }
          });
      })
      .then((elementBox) => {
        // Return the jquery element
        if (!elementBox) {
          // Attempt the escape hatch to try to using manual
          // classification
          return cy.findByAI(selector);
        }
        return matchBoundingBoxToCypressElement(elementBox);
      });
  }) as unknown as Cypress.Chainable<JQuery<HTMLElement> | null>;
}

const createTestElementFromDOMRect = (rect: DOMRect) => ({
  x: rect.left,
  y: rect.top,
  width: rect.right - rect.left,
  height: rect.bottom - rect.top,
});

const getElementRectangle = (el: JQuery<HTMLElement>) => {
  return el[0].getBoundingClientRect() || null;
};

const resetDetectMode = () => {
  currentDetectLink = '';
  manualDetectMode = false;
};

const getIfElementHasModel = (selector: string, screenshotUuid: string) => {
  return getSmartDriverClient().then((client) => {
    return client
      .getTestCaseBox(selector, screenshotUuid)
      .then((res) => {
        const { predicted_element } = res;
        return predicted_element;
      })
      .then((elemBox) => {
        return elemBox ? true : false;
      });
  });
};

let originalFn = null;
const muteCypressLogs = () => {
  originalFn = Cypress.log;
  // @ts-expect-error this is temporary to mute polling info
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Cypress.log = () => {};
};
const reenableCypressLogs = () => {
  if (originalFn) {
    Cypress.log = originalFn;
  }
};

/**
 * Call the 'detect' API and checks if there is a model for it
 * already. If there is no model, asks the user to add a bounding
 * box on the web app by opening their default browser. At the end,
 * returns an element most closely matched to that model.
 * @param selector
 */
const findByAI = (selector: string) => {
  const testName = Cypress.currentTest.title;
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
  getSmartDriverClient().then((client) => {
    cy.then({ timeout: timeoutLength }, () => {
      const startTime = Date.now();
      if (manualDetectMode && inInteractiveMode()) {
        cy.task('openClassifyTab', currentDetectLink)
          .then(() => {
            const { screenshotUuid } =
              SmartDriver.getTestCaseScreenshotInformation();
            return getIfElementHasModel(selector, screenshotUuid);
          })
          .then({ timeout: timeoutLength }, (hasModel) => {
            let elementClassified = false;
            if (hasModel) {
              return null;
            }

            return new Cypress.Promise((resolve, reject) => {
              // every second, check
              muteCypressLogs();
              const timeoutWithBuffer = timeoutLength * 0.95;

              const timerId = setInterval(async () => {
                const { screenshotUuid } =
                  SmartDriver.getTestCaseScreenshotInformation();
                const { predicted_element } =
                  await window.smartDriverClient.getTestCaseBox(
                    selector,
                    screenshotUuid,
                  );
                if (predicted_element) {
                  elementClassified = true;
                  clearInterval(timerId);
                  return resolve();
                }
                const currentTime = getSecondsElapsed(startTime);
                if (currentTime > timeoutWithBuffer) {
                  clearInterval(timerId);
                  return reject(new Error(errorMessage));
                }
              }, 1000);

              (function pollBoundaryBox() {
                if (elementClassified) return resolve();
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
          .then(() => {
            reenableCypressLogs();
            resetDetectMode();
          });
      }
    });

    cy.screenshot('temp', { overwrite: true, capture: 'viewport' })
      .readFile(getScreenshotFilePath('temp'), 'base64')
      .then((b64screenshot) => {
        const b64hash = getScreenshotHash(b64screenshot);
        SmartDriver.setTestScreenshot({
          screenshotFileName: 'temp',
          screenshotUuid: b64hash,
        });
        cy.log('SmartDriver: Retrieving element 🔧');
        return client.classifyObject(b64screenshot, '', selector, testName);
      })
      .then(({ predicted_element }) => {
        const elementFound =
          matchBoundingBoxToCypressElement(predicted_element);
        if (!elementFound) {
          throw new Error('SmartDriver: No element found for ' + selector);
        }
        return elementFound;
      });
  });
};

const handleUploadingScreenshot = (
  screenshot_exists: boolean,
  client: DevToolsAiSDK,
  selector: string,
  testName: string,
  b64hash: string,
  element: JQuery<HTMLElement>,
  b64screenshot: string,
) => {
  if (screenshot_exists) {
    return cy
      .log('SmartDriver: Screenshot exists, skipping upload ' + b64hash)
      .then(() => {
        const elementRectangle = getElementRectangle(element);
        const elementBox = createTestElementFromDOMRect(elementRectangle);
        return client.updateTestElement(
          elementBox,
          b64hash,
          selector,
          testName,
          false,
        );
      });
  } else {
    return cy
      .log('SmartDriver: Screenshot does not exist. Uploading 🚚')
      .then(() => {
        const elementRectangle = getElementRectangle(element);
        const elementBox = createTestElementFromDOMRect(elementRectangle);
        return client
          .uploadTestElementScreenshot(b64screenshot, selector, testName)
          .then(({ screenshot_uuid }) => {
            return client.updateTestElement(
              elementBox,
              screenshot_uuid,
              selector,
              testName,
              false,
            );
          });
      });
  }
};

const devToolsGet = (selector: string) => {
  const testName = Cypress.currentTest.title;
  getSmartDriverClient().then((client) => {
    let elementFound: JQuery<HTMLElement> | undefined;

    cy.then(() => {
      cy.log('SmartDriver: Element not found, attempting using AI.');
      cy.getByAI(selector).then((element) => {
        elementFound = element;
      });
    });

    cy.then(() => {
      return client.getIfFrozen(selector).then((res) => {
        const { is_frozen } = res;
        if (!is_frozen) {
          cy.log('Element not frozen, uploading');
          return cy
            .screenshot('temp', { overwrite: true, capture: 'viewport' })
            .readFile(getScreenshotFilePath('temp'), 'base64')
            .then((b64screenshot) => {
              const b64hash = getScreenshotHash(b64screenshot);
              // We need to return here to
              // actually resolve this and move to the next
              // step.
              // Save the screenshot details
              SmartDriver.setTestScreenshot({
                screenshotFileName: 'temp',
                screenshotUuid: b64hash,
              });
              return client
                .getIfScreenshotExists(b64hash, selector)
                .then((res) => {
                  const { screenshot_exists } = res;
                  return handleUploadingScreenshot(
                    screenshot_exists,
                    client,
                    selector,
                    testName,
                    b64hash,
                    elementFound,
                    b64screenshot,
                  );
                })
                .then(() => {
                  return elementFound;
                });
            });
        } else {
          cy.log('SmartDriver: Element is frozen, skipping upload.');
          return elementFound;
        }
      });
    });
  });
};

Cypress.Commands.add('findByAI', findByAI);
Cypress.Commands.add('getByAI', getByAI);
Cypress.on('test:before:run', () => {
  // Reset our run
  currentCommandQueue.splice(0, currentCommandQueue.length);
});
Cypress.on('fail', (err) => {
  const { message } = err;

  const lastCommand = currentCommandQueue.pop();

  if (lastCommand === 'get' || lastCommand === 'find') {
    SmartDriver.setIsInBackupMode(true);
  }
  if (
    message.includes('no model found - Please visit') &&
    inInteractiveMode()
  ) {
    // we did this. we are good.
    const linkStart = message.indexOf('https://');
    const linkEnd = message.indexOf(' ', linkStart);
    manualDetectMode = true;
    currentDetectLink = message.substring(linkStart, linkEnd);
  }

  throw err;
});

Cypress.Commands.overwrite('find', (originalFn, _, findSelector) => {
  currentCommandQueue.push('find');
  //@ts-expect-error findSelector is mapped to the wrong type
  SmartDriver.cacheSelector(findSelector);
  //@ts-expect-error findSelector is mapped to the wrong type
  if (SmartDriver.getShouldUseAI(findSelector)) {
    //@ts-expect-error this is actually the string given into the find function
    return devToolsGet(findSelector);
  }
  if (SmartDriver.getIsInBackupMode()) {
    SmartDriver.resetCurrentMode();
    //@ts-expect-error see above
    SmartDriver.updateSelector(findSelector, true);

    //@ts-expect-error see above
    return devToolsGet(findSelector);
  }
  return originalFn(_);
});

Cypress.Commands.overwrite('get', (originalFn, selector: string, options) => {
  currentCommandQueue.push('get');

  if (SmartDriver.getShouldUseAI(selector)) {
    return devToolsGet(selector);
  }
  if (SmartDriver.getIsInBackupMode()) {
    // reset being in backup mode
    SmartDriver.updateSelector(selector, true);

    SmartDriver.resetCurrentMode();
    return devToolsGet(selector);
  }

  // If the element is found as normal,
  // upload the screenshot if it isn't frozen,
  // add the model found,
  // return the element

  const testName = Cypress.currentTest.title;

  if (selector.includes(':cy-')) {
    // we don't ingest these yet. These are chained commands
    return originalFn(selector, options);
  }

  const getWithAutoIngest = (selector, options) => {
    getSmartDriverClient().then((client) => {
      cy.then(() => {
        return client.getIfFrozen(selector).then((response) => {
          const { is_frozen } = response;
          if (is_frozen) {
            cy.log('SmartDriver: Element is frozen, skipping upload.');
            return originalFn(selector, options);
          } else {
            cy.log('Element not frozen, uploading');
            return cy
              .screenshot('temp', { overwrite: true, capture: 'viewport' })
              .readFile(getScreenshotFilePath('temp'), 'base64')
              .then((b64screenshot) => {
                const b64hash = getScreenshotHash(b64screenshot);
                SmartDriver.setTestScreenshot({
                  screenshotFileName: 'temp',
                  screenshotUuid: b64hash,
                });
                return client
                  .getIfScreenshotExists(b64hash, selector)
                  .then((res) => {
                    const { screenshot_exists } = res;
                    if (screenshot_exists) {
                      cy.log(
                        'SmartDriver: Screenshot exists already, skipping upload',
                      );
                      const screenshot_uuid = b64hash;
                      originalFn(selector)
                        .then(getElementRectangle)
                        .then((rect) => {
                          const element = createTestElementFromDOMRect(rect);
                          client.updateTestElement(
                            element,
                            screenshot_uuid,
                            selector,
                            testName,
                            false,
                          );
                        });
                    } else {
                      cy.log(
                        'SmartDriver: Screenshot does not exist. Uploading 🚚',
                      );
                      return client
                        .uploadTestElementScreenshot(
                          b64screenshot,
                          selector,
                          testName,
                        )
                        .then((res) => {
                          const { screenshot_uuid } = res;
                          originalFn(selector)
                            .then(getElementRectangle)
                            .then((rect) => {
                              const element =
                                createTestElementFromDOMRect(rect);
                              client.updateTestElement(
                                element,
                                screenshot_uuid,
                                selector,
                                testName,
                                false,
                              );
                            });
                        });
                    }
                  })
                  .then(() => {
                    return originalFn(selector, options);
                  });
              });
          }
        });
      });
    });
  };
  return getWithAutoIngest(selector, options);
});
