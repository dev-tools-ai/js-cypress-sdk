import { getImageFileAsBase64 } from '../utils';
import { DevToolsAiSDK } from '@devtools-ai/js-sdk';
import type * as DevToolsAiAPIResponse from '@devtools-ai/js-sdk';

const DEBUG_MODE = process.env.NODE_ENV !== 'production';

type classifyResponse = {
  element: Cypress.Chainable<JQuery<HTMLElement>>;
  screenshotUuid: string;
  message: string;
} | null;

/**
 * Checks if a screenshot exists given the uuid and the element name.
 * @param screenshotUUID
 * @param elementName
 * @returns
 */
export async function checkScreenshotExists(
  screenshotUUID: string,
  elementName: string,
  devToolsAiSDK: DevToolsAiSDK,
) {
  const start = DEBUG_MODE ? new Date().getTime() / 1000 : 0;
  const request = await devToolsAiSDK.getIfScreenshotExists(
    screenshotUUID,
    elementName,
  );

  const end = DEBUG_MODE ? new Date().getTime() / 1000 : 0;
  if (DEBUG_MODE) {
    console.log(`Cached bounding box request time: ${end - start}ms`);
  }

  return request;
}

/**
 * Takes a screenshot of the current page in the test and then uploads
 * it to the API.
 * @param elementName
 * @param testCaseId
 * @param devToolsAiSDK
 * @returns
 */
async function testCaseUploadScreenshot(
  elementName: string,
  testCaseId: string,
  devToolsAiSDK: DevToolsAiSDK,
): Promise<DevToolsAiAPIResponse.updateTestElementResponse | null> {
  let apiResponse: DevToolsAiAPIResponse.uploadTestElementScreenshot | null =
    null;
  cy.screenshot(elementName, {
    async onAfterScreenshot(_, props) {
      const { path } = props;
      const screenshotBase64 = await getImageFileAsBase64(path);
      if (!screenshotBase64) {
        return;
      }
      apiResponse = await devToolsAiSDK.uploadTestElementScreenshot(
        screenshotBase64,
        elementName,
        testCaseId,
      );
    },
  });
  return apiResponse;
}

async function getScreenshot(elementName: string) {
  let screenshotData: string | null = null;
  cy.screenshot(elementName, {
    onAfterScreenshot: async (_, props) => {
      const { path } = props;
      const screenshotBase64 = (await getImageFileAsBase64(path)) as string;
      if (!screenshotBase64) {
        return;
      }
      screenshotData = screenshotBase64;
    },
  });

  return screenshotData as unknown as string;
}

async function getTestCaseBox(
  label: string,
  screenshotUuid: string,
  useClassifierDuringCreation = true,
  sdk: DevToolsAiSDK,
) {
  const response = await sdk.getTestCaseBox(
    label,
    screenshotUuid,
    useClassifierDuringCreation,
  );
  if (response.success) {
    return response.predicted_element;
  }
  return null;
}
