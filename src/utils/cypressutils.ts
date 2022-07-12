import { zip } from './sortUtils';

export type elementBoundaryBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  tagName?: string;
  element?: HTMLElement;
};

export function iouBoxes(box1: elementBoundaryBox, box2: elementBoundaryBox) {
  return iou(box1, box2);
}

export function matchBoundingBoxToCypressElement(
  boundingBox: elementBoundaryBox,
) {
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
      for (const [_, currWebElement] of composite) {
        const { tagName, element } = currWebElement;
        if (tagName === 'input' || tagName === 'button') {
          return element;
        }
      }
      return composite[0][1].element;
    });
}

export function iou(
  elementBox: elementBoundaryBox,
  targetBox: elementBoundaryBox,
) {
  return (
    areaOverlap(elementBox, targetBox) /
    (area(elementBox.width, elementBox.height) +
      area(targetBox.width, targetBox.height) -
      areaOverlap(elementBox, targetBox))
  );
}

export function getBoundaryBoxFromCypressElement(element: Element) {
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
}

function areaOverlap(
  elementBox: elementBoundaryBox,
  targetBox: elementBoundaryBox,
) {
  const { x: x1, y: y1, width: w1, height: h1 } = elementBox;
  const { x: x2, y: y2, width: w2, height: h2 } = targetBox;
  const dx = Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2);
  const dy = Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2);
  if (dx >= 0 && dy >= 0) {
    return dx * dy;
  }
  return 0;
}

export function area(x: number, y: number) {
  return x * y;
}

export function centerHit(box1: elementBoundaryBox, box2: elementBoundaryBox) {
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
}

type testScreenshot = {
  screenshotUuid: string;
  screenshotFileName: string;
};
type testCaseDetails = {
  screenshot?: testScreenshot;
};

export class SmartDriverManager {
  selectorCache = new Map<string, boolean>();
  isInBackupMode = false;
  testCaseInformation: testCaseDetails = { screenshot: undefined };
  getIsInBackupMode() {
    return this.isInBackupMode;
  }

  resetCurrentMode() {
    this.isInBackupMode = false;
  }

  setTestScreenshot(updatedScreenshotInfo: testScreenshot) {
    this.testCaseInformation = {
      ...this.testCaseInformation,
      screenshot: { ...updatedScreenshotInfo },
    };
  }

  getTestCaseScreenshotInformation() {
    return this.testCaseInformation.screenshot;
  }

  setIsInBackupMode(useBackupMode: boolean) {
    this.isInBackupMode = useBackupMode;
  }

  getShouldUseAI(selector: string) {
    return this.selectorCache.get(selector);
  }

  cacheSelector(selector: string) {
    if (!this.selectorCache.has(selector)) {
      this.selectorCache.set(selector, false);
    }
  }

  updateSelector(selector: string, useAI: boolean) {
    this.selectorCache.set(selector, useAI);
  }
}
