export { getGeminiApiKeys } from '@/config/constants';

export const env = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Genesis',
    env: process.env.NODE_ENV || 'development',
  },
  features: {
    enableImageAnalysis: true,
    enableMultipleModels: true,
  },
};

export const validateEnv = () => {
  const { getGeminiApiKeys } = require('@/config/constants');
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    return { valid: false, errors: ['GEMINI_API_KEY tidak dikonfigurasi'] };
  }
  return { valid: true, errors: [] };
};
