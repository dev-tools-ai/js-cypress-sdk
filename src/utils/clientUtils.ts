import { getSDKConfigFromCypress } from './configUtils';
import { createSDK } from '@devtools-ai/js-sdk';
import type { createSDKOptions } from '@devtools-ai/js-sdk';
/**
 * Returns the SmartDriver JS SDK client
 * @returns
 */
export const getSmartDriverClient = () => {
  const config = getSDKConfigFromCypress();
  if (window.smartDriverClient) return window.smartDriverClient;

  const client = createSDK({
    ...(config as createSDKOptions),
    screenMultiplier: window.devicePixelRatio,
  });

  window.smartDriverClient = client;

  return window.smartDriverClient;
};
