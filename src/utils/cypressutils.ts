import { getScreenshotHash } from './imageUtils';
import { zip } from './sortUtils';

export type elementBoundaryBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  tagName?: string;
  element?: HTMLElement;
};

export const iouBoxes = (
  box1: elementBoundaryBox,
  box2: elementBoundaryBox,
) => {
  return iou(box1, box2);
};

export const matchBoundingBoxToCypressElement = (
  boundingBox: elementBoundaryBox,
) => {
  const pixelRatio = window.devicePixelRatio;
  const newBoundaryBox = {
    x: boundingBox['x'] / pixelRatio,
    y: boundingBox['y'] / pixelRatio,
    width: boundingBox['width'] / pixelRatio,
    height: boundingBox['height'] / pixelRatio,
    element: boundingBox['element'],
  } as elementBoundaryBox;

  return cy
    .window()
    .then((window) => {
      return window.document.body.getElementsByTagName('*');
    })
    .then((elemList) => {
      const elementList: elementBoundaryBox[] = [];
      Object.values(elemList).forEach((elem) => {
        if (elem.tagName) {
          elementList.push(getBoundaryBoxFromCypressElement(elem));
        }
      });
      const iouScores = elementList.map((element) => {
        return iouBoxes(newBoundaryBox, element);
      });
      let composite = [...zip(iouScores, elementList)].sort().reverse();
      composite = composite.filter((x) => x[0] > 0);
      composite = [...composite.filter((x) => centerHit(newBoundaryBox, x[1]))];
      return composite;
    })
    .then((composite) => {
      if (!composite.length) {
        cy.log('SmartDriver Error: No element found');
        return null;
      }
      const maxScore = composite[0][0];
      for (const [score, currWebElement] of composite) {
        const { tagName, element } = currWebElement;
        if (
          (tagName === 'input' || tagName === 'button') &&
          score >= maxScore * 0.5
        ) {
          return element;
        }
      }
      return composite[0][1].element;
    });
};

export const iou = (
  elementBox: elementBoundaryBox,
  targetBox: elementBoundaryBox,
) => {
  return (
    areaOverlap(elementBox, targetBox) /
    (area(elementBox.width, elementBox.height) +
      area(targetBox.width, targetBox.height) -
      areaOverlap(elementBox, targetBox))
  );
};

export const getBoundaryBoxFromCypressElement = (element: Element) => {
  const elementTagName = element.tagName;

  const { x, y, right, left, top, bottom } = element.getBoundingClientRect();
  return {
    x: x,
    y: y,
    width: right - left,
    height: bottom - top,
    tagName: elementTagName,
    element: element,
  } as elementBoundaryBox;
};

const areaOverlap = (
  elementBox: elementBoundaryBox,
  targetBox: elementBoundaryBox,
) => {
  const { x: x1, y: y1, width: w1, height: h1 } = elementBox;
  const { x: x2, y: y2, width: w2, height: h2 } = targetBox;
  const dx = Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2);
  const dy = Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2);
  if (dx >= 0 && dy >= 0) {
    return dx * dy;
  }
  return 0;
};

export const area = (x: number, y: number) => {
  return x * y;
};

export const centerHit = (
  box1: elementBoundaryBox,
  box2: elementBoundaryBox,
) => {
  const { x: x1, y: y1, width: w1, height: h1 } = box1;

  const box1Center = {
    x: x1 + w1 / 2,
    y: y1 + h1 / 2,
  };
  if (
    box1Center.x > box2.x &&
    box1Center.x < box2.x + box2.width &&
    box1Center.y > box2.y &&
    box1Center.y < box2.y + box2.height
  ) {
    return true;
  }
  return false;
};

type testScreenshot = {
  screenshotUuid: string;
  screenshotFileName: string;
};
type testCaseDetails = {
  screenshot?: testScreenshot;
};

export const createTestElementFromDOMRect = (rect: DOMRect) => ({
  x: rect.left,
  y: rect.top,
  width: rect.right - rect.left,
  height: rect.bottom - rect.top,
});

export const getElementRectangle = (el: JQuery<HTMLElement>) => {
  return el[0].getBoundingClientRect() || null;
};

export class SmartDriverManager {
  _selectorCache: Map<string, boolean>;
  _isInBackupMode = false;
  _testCasesScreenshots: Map<string, string>;
  _commandStack: Map<number, { selector: string; command: string } | undefined>;
  _testCaseInformation: testCaseDetails;

  constructor() {
    this._selectorCache = new Map<string, boolean>();
    this._testCasesScreenshots = new Map<string, string>();
    this._commandStack = new Map<
      number,
      { selector: string; command: string } | undefined
    >();
    this._testCaseInformation = { screenshot: undefined };
  }

  /**
   * Returns if we are working in a retry mode
   * @returns
   */
  getIsInBackupMode() {
    return this._isInBackupMode;
  }

  /**
   * Reset the current mode for the test.
   */
  resetCurrentMode() {
    this._isInBackupMode = false;
  }

  /**
   * Saves the screenshot's unique hash using the screenshot data.
   * Note: It does not save the original screenshot data
   * @param {string} fileName
   * @param {string} screenshotb64
   * @returns {string} Screenshot hash
   */
  setTestScreenshot(fileName: string, screenshot64: string) {
    const b64Hash = getScreenshotHash(screenshot64);
    this._testCasesScreenshots.set(fileName, b64Hash);
    return b64Hash;
  }

  getTestCaseScreenshotInformation(fileName: string) {
    const hash = this._testCasesScreenshots.get(fileName);
    return {
      screenshotUuid: hash,
      screenshotFileName: fileName,
    };
  }

  createFailState() {
    // called whenever cypress fails a test
    // the last command in our queue might be have failed to grab an
    // element
    if (!this._commandStack.size) return;
    this._isInBackupMode = true;
    const lastCommand = this._commandStack.get(this._commandStack.size);

    if (!lastCommand) return;
    const { selector } = lastCommand;
    this._selectorCache.set(selector, true);
  }

  addCommandToStack(selector: string, command: 'get' | 'find') {
    const nextIndex = this._commandStack.size + 1;
    this._commandStack.set(nextIndex, {
      selector,
      command,
    });
  }

  getShouldUseAI(selector: string) {
    return this._selectorCache.get(selector);
  }

  cacheSelector(selector: string) {
    if (!this._selectorCache.has(selector)) {
      this._selectorCache.set(selector, false);
    }
  }

  updateSelector(selector: string, useAI: boolean) {
    this._selectorCache.set(selector, useAI);
  }
}

let _originalLogFn = null;
/**
 * Mutes the logging done by Cypress. Particularly useful when polling
 * or making repeated network calls and spamming the log is desireable.
 */
export const muteCypressLogs = () => {
  _originalLogFn = Cypress.log;
  if (Cypress.version >= '10.0.0') {
    // @ts-expect-error this is temporary to mute polling info
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    Cypress.log = () => {};
  }
};

/**
 * Reenables the ability to log items in Cypress
 */
export const reenableCypressLogs = () => {
  if (_originalLogFn) {
    Cypress.log = _originalLogFn;
  }
};

export const generateImageUUID = () => {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return (
    'temp-devtools-' +
    pattern.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
};
