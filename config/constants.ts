import { AIModel, AIProvider, ModelConfig } from '@/types';

// API Configuration
export const API_CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL_ID: 'gemini-3-flash-preview',
  // OpenRouter API - Requires account at https://openrouter.ai
  // Get your API key at: https://openrouter.ai/keys
  // Note: Free models available after registration
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  OPENROUTER_SITE_NAME: 'Deftorch',
};

// Helper to get all configured Gemini API keys for rotation
export function getGeminiApiKeys(userKey?: string): string[] {
  const keys: string[] = [];
  
  if (userKey) {
    keys.push(userKey);
  }
  
  if (process.env.GEMINI_API_KEY) {
    if (!keys.includes(process.env.GEMINI_API_KEY)) {
      keys.push(process.env.GEMINI_API_KEY);
    }
  }
  
  let index = 1;
  while (true) {
    const key = process.env[`GEMINI_API_KEY_${index}`];
    if (!key) break;
    if (!keys.includes(key)) {
      keys.push(key);
    }
    index++;
  }
  
  return keys;
}

// Image Analysis Models
export const IMAGE_ANALYSIS_MODELS = [
  {
    id: 'gemini-native',
    name: 'Gemini 2.0 Flash (Native)',
    provider: 'google',
    apiType: 'gemini-native',
    modelId: 'gemini-2.0-flash-exp',
    description: 'Google native API - Fast & free',
    free: true,
  },
  {
    id: 'gemini-flash-lite',
    name: 'Gemini Flash Lite (Native)',
    provider: 'google',
    apiType: 'gemini-native',
    modelId: 'gemini-flash-lite-latest',
    description: 'Google native API - Fast & free',
    free: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash (Native)',
    provider: 'google',
    apiType: 'gemini-native',
    modelId: 'gemini-3-flash-preview',
    description: 'Google native API - Next generation',
    free: true,
  },
  {
    id: 'gemini-openrouter',
    name: 'Gemini 2.0 Flash (OpenRouter)',
    provider: 'google',
    apiType: 'openrouter',
    modelId: 'google/gemini-2.0-flash-exp:free',
    description: 'Via OpenRouter - Free',
    free: true,
  },
  // Note: GLM-4.5 Air does not support image input on OpenRouter
  // {
  //   id: 'glm-4.5-air',
  //   name: 'GLM-4.5 Air',
  //   provider: 'zhipu',
  //   apiType: 'openrouter',
  //   modelId: 'z-ai/glm-4.5-air:free',
  //   description: 'Chinese AI model - Free (Text only)',
  //   free: true,
  // }
];

export const AI_MODELS: Record<AIModel, { name: string; provider: AIProvider; contextWindow: number }> = {
  'gemini-3-flash': {
    name: 'Gemini 3 Flash (Preview)',
    provider: 'google',
    contextWindow: 1048576,
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1048576,
  },
  'gemini-2.5-flash-lite': {
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    contextWindow: 1048576,
  },
};

// Default Model Configuration
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'google',
  model: 'gemini-3-flash',
  systemInstruction: 'You are Deftorch, a creative AI assistant specialized in intelligent orchestration, reasoning, and generating visual content using Web technologies.',
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

// Model Pricing (per 1K tokens)
export const MODEL_PRICING = {
  'gemini-3-flash': { input: 0, output: 0 },
  'gemini-2.5-flash': { input: 0, output: 0 },
  'gemini-2.5-flash-lite': { input: 0, output: 0 },
};

// Image Analysis Types
export const ANALYSIS_TYPES = [
  { value: 'object-detection', label: 'Object Detection', icon: '🎯' },
  { value: 'label-detection', label: 'Label Detection', icon: '🏷️' },
  { value: 'text-recognition', label: 'Text Recognition (OCR)', icon: '📝' },
  { value: 'face-detection', label: 'Face Detection', icon: '👤' },
  { value: 'landmark-recognition', label: 'Landmark Recognition', icon: '🗺️' },
  { value: 'image-description', label: 'Image Description', icon: '📸' },
  { value: 'visual-qa', label: 'Visual Q&A', icon: '❓' },
] as const;

// File Upload Constraints (frontend-facing — what the file picker accepts)
//
// IMPORTANT: this list is deliberately kept in lockstep with what
// lib/magic-bytes.ts can actually verify server-side. The old version of
// this config listed .doc/.docx/.csv/.txt/.md as accepted — none of
// which had (or have) a magic-byte check, and app/api/upload-image/route.ts
// hard-rejected anything that wasn't an image/* MIME type regardless of
// what this config promised. That's the exact gap Fase D item 4 in
// rencana-pengembangan-deftorch-lanjutan.md calls out. Rather than
// re-promise formats that still aren't validated, this only lists what
// MEDIA_LIMITS below (and magic-bytes.ts) genuinely support end-to-end:
// image, PDF, MP4 video, WAV audio. Adding another format means adding
// its signature to magic-bytes.ts FIRST, then it belongs here.
export const FILE_UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB — legacy cap, still used by the
  // Supabase-Storage image-only path in app/api/upload-image/route.ts.
  // The R2 multi-modal path (app/api/upload-media/*) uses MEDIA_LIMITS
  // below instead, which allows much larger video/audio files.
  maxFiles: 50,
  acceptedTypes: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'video/mp4',
    'audio/wav', 'audio/x-wav',
  ],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.mp4', '.wav'],
};

// Media upload limits — backend-authoritative counterpart to
// FILE_UPLOAD_CONFIG above, used by app/api/upload-media/presign/route.ts
// to reject oversized requests before generating a presigned URL, and by
// the Gemini File API integration (large files go through fileUri, not
// inline base64 — see lib/gemini-file-upload.ts) to decide which path to
// use per file. Gemini's own inline-base64 request size ceiling is
// ~20MB total request payload; INLINE_MAX_BYTES is kept well under that
// so a request with several small attachments still fits.
export const MEDIA_LIMITS = {
  image: { maxBytes: 15 * 1024 * 1024 }, // 15MB
  document: { maxBytes: 25 * 1024 * 1024 }, // 25MB
  video: { maxBytes: 500 * 1024 * 1024 }, // 500MB — Gemini File API's own ceiling is 2GB/file; this is Deftorch's own cap, not Gemini's
  audio: { maxBytes: 100 * 1024 * 1024 }, // 100MB
  INLINE_MAX_BYTES: 4 * 1024 * 1024, // below this, send inline base64 to Gemini instead of uploading to the File API — not worth the extra round trip for a 200KB image
} as const;

// App Constants
export const APP_CONFIG = {
  name: 'Deftorch',
  version: '1.0.0',
  description: 'Intelligent AI Chatbot with Image Analysis',
  maxChatHistory: 100,
  autoSaveInterval: 30000, // 30 seconds
  maxMessageLength: 4000,
  defaultTheme: 'system' as const,
};

// API Endpoints (for future backend integration)
export const API_ENDPOINTS = {
  chat: '/api/chat',
  imageAnalysis: '/api/image-analysis',
  models: '/api/models',
  settings: '/api/settings',
  auth: '/api/auth',
  export: '/api/export',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  chats: 'genesis-chats',
  currentChat: 'genesis-current-chat',
  modelConfig: 'genesis-model-config',
  userPreferences: 'genesis-preferences',
  apiKeys: 'genesis-api-keys',
  projects: 'genesis-projects',
};

// Toast Messages
export const TOAST_MESSAGES = {
  chatSaved: 'Chat saved successfully',
  chatDeleted: 'Chat deleted successfully',
  chatRenamed: 'Chat renamed successfully',
  imageSizeError: 'Image size exceeds maximum limit',
  imageTypeError: 'Invalid image type',
  copySuccess: 'Copied to clipboard',
  exportSuccess: 'Chat exported successfully',
  settingsSaved: 'Settings saved successfully',
  apiKeyInvalid: 'Invalid API key',
  networkError: 'Network error. Please try again.',
};
