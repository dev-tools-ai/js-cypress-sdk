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
    console.error('There was an issue reading the existing screenshot.', e);
    return null;
  } finally {
    // Close our data stream
    fileData?.close();
  }
};

export async function getImageFileAsBase64(filePath: string) {
  const base64File = readFileSync(filePath, 'base64');

  return base64File || null;
}

/**
 * Gets the screenshot uuid from a base64 encoded screenshot
 * @param b64Screenshot
 * @returns
 */
export function getScreenshotHash(b64Screenshot: string) {
  const hashDigest = MD5(b64Screenshot).toString();
  return hashDigest;
}
