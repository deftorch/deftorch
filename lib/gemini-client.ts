import { getGeminiApiKeys } from '@/config/constants';
import { logger } from '@/lib/logger';

/**
 * Helper to call Google Generative Language API (Gemini) with key rotation.
 * Iterates through configured Gemini API keys, attempting to fulfill the request.
 * 
 * @param modelId The Gemini model identifier (e.g. gemini-2.5-flash)
 * @param requestBody The JSON body for the generateContent request
 * @returns The parsed JSON response data from the Gemini API
 */
export async function callGeminiWithRotation(modelId: string, requestBody: any, userKey?: string): Promise<any> {
  const apiKeys = getGeminiApiKeys(userKey);
  if (apiKeys.length === 0) {
    throw new Error('Gemini API key not configured');
  }

  let lastErrorText = '';
  let lastStatus = 500;
  let success = false;
  let responseData: any = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    logger.debug('Gemini request attempt', { keyIndex: i + 1, totalKeys: apiKeys.length, modelId });
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${currentKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        responseData = await response.json();
        success = true;
        break;
      }

      lastStatus = response.status;
      lastErrorText = await response.text();
      logger.warn('Gemini key failed', { keyIndex: i + 1, status: lastStatus, error: lastErrorText });
    } catch (fetchError: any) {
      logger.error('Gemini fetch error', { keyIndex: i + 1, error: fetchError.message });
      lastErrorText = fetchError.message;
      lastStatus = 500;
    }
  }

  if (!success || !responseData) {
    const isQuota = lastStatus === 429 ||
                    lastErrorText.toLowerCase().includes('quota') ||
                    lastErrorText.toLowerCase().includes('exhausted') ||
                    lastErrorText.toLowerCase().includes('rate limit') ||
                    lastErrorText.toLowerCase().includes('too many requests') ||
                    lastErrorText.toLowerCase().includes('limit reached') ||
                    lastErrorText.toLowerCase().includes('key expired') ||
                    lastErrorText.toLowerCase().includes('invalid');

    if (isQuota) {
      const quotaError = new Error('Your daily usage limit has been reached. Please come back tomorrow.');
      (quotaError as any).status = 429;
      (quotaError as any).details = `All Gemini API keys exhausted. Last error (${lastStatus}): ${lastErrorText}`;
      throw quotaError;
    }

    const standardError = new Error(`Gemini API error (${lastStatus}): ${lastErrorText}`);
    (standardError as any).status = lastStatus;
    (standardError as any).details = lastErrorText;
    throw standardError;
  }

  return responseData;
}

/**
 * Helper to call Google Generative Language API (Gemini) with key rotation, returning a stream.
 */
export async function streamGeminiWithRotation(modelId: string, requestBody: any, userKey?: string): Promise<Response> {
  const apiKeys = getGeminiApiKeys(userKey);
  if (apiKeys.length === 0) {
    throw new Error('Gemini API key not configured');
  }

  let lastErrorText = '';
  let lastStatus = 500;
  let success = false;
  let response: Response | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    logger.debug('Gemini stream request attempt', { keyIndex: i + 1, totalKeys: apiKeys.length, modelId });
    
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${currentKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (res.ok) {
        response = res;
        success = true;
        break;
      }

      lastStatus = res.status;
      lastErrorText = await res.text();
      logger.warn('Gemini stream key failed', { keyIndex: i + 1, status: lastStatus, error: lastErrorText });
    } catch (fetchError: any) {
      logger.error('Gemini stream fetch error', { keyIndex: i + 1, error: fetchError.message });
      lastErrorText = fetchError.message;
      lastStatus = 500;
    }
  }

  if (!success || !response) {
    const isQuota = lastStatus === 429 ||
                    lastErrorText.toLowerCase().includes('quota') ||
                    lastErrorText.toLowerCase().includes('exhausted') ||
                    lastErrorText.toLowerCase().includes('rate limit') ||
                    lastErrorText.toLowerCase().includes('too many requests') ||
                    lastErrorText.toLowerCase().includes('limit reached') ||
                    lastErrorText.toLowerCase().includes('key expired') ||
                    lastErrorText.toLowerCase().includes('invalid');

    if (isQuota) {
      const quotaError = new Error('Your daily usage limit has been reached. Please come back tomorrow.');
      (quotaError as any).status = 429;
      (quotaError as any).details = `All Gemini API keys exhausted. Last error (${lastStatus}): ${lastErrorText}`;
      throw quotaError;
    }

    const standardError = new Error(`Gemini API error (${lastStatus}): ${lastErrorText}`);
    (standardError as any).status = lastStatus;
    (standardError as any).details = lastErrorText;
    throw standardError;
  }

  return response;
}
