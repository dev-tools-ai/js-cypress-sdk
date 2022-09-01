import { promises, readFileSync } from 'fs';
import { MD5 } from 'crypto-js';

enum fileFormats {
  PNG = 'png',
}

export type imageDimensionsResults = {
  readonly format: fileFormats;
  readonly width: number;
  readonly height: number;
};

/**
 * Returns the display scaling factor of the screenshot relative to the
 * current viewport size. Intended to be used with a screenshot taken in the same test case session.
 * @param screenshotBase64
 * @returns
 */
export const getMultiplier = async (screenshotBase64: string) => {
  const width = Cypress.config('viewportWidth');

  const fileProperties = await getPNGImageDimensions(screenshotBase64);
  if (!fileProperties) {
    throw new Error('Getting image dimensions failed');
  }
  return 1.0 * (fileProperties.width / width);
};

/**
 * Gets the dimensions of a png image
 * @param imagePNGBase64
 * @returns
 */
export const getPNGImageDimensions = async (imagePNGBase64: string) => {
  let fileData: promises.FileHandle | undefined;
  try {
    fileData = await promises.open(imagePNGBase64, 'r');
    const pngHeaderLength = 24;
    const dataOffset = 16;

    const b = Buffer.alloc(pngHeaderLength);
    await fileData.read(b, 0, pngHeaderLength, 0);

    const result = {
      format: fileFormats.PNG,
      width: b.readUInt32BE(dataOffset),
      height: b.readUInt32BE(4 + dataOffset),
    } as imageDimensionsResults;
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('There was an issue reading the existing screenshot.', e);
    return null;
  } finally {
    // Close our data stream
    fileData?.close();
  }
};

export const getImageFileAsBase64 = async (filePath: string) => {
  const base64File = readFileSync(filePath, 'base64');
  return base64File || null;
};

/**
 * Gets the screenshot uuid from a base64 encoded screenshot
 * @param b64Screenshot
 * @returns
 */
export const getScreenshotHash = (b64Screenshot: string) => {
  const hashDigest = MD5(b64Screenshot).toString();
  return hashDigest;
};

/**
 * Returns the screenshot filepath after Cypress has taken. Cypress renames
 * files depending on the amount of attempts so this is needed often.
 *
 * @usage const filepath = getScreenshotFilePath('testscreenshot')
 * @param fileName
 * @returns
 */
export const getScreenshotFilePath = (fileName: string) => {
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
};
