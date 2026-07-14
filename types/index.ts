// types/index.ts

// --- Deftorch Provider & Model Types ---
export type AIProvider = string;
export type AIModel = string;

export interface ProviderInfo {
  id: string;
  name: string;
  logo: string;
  description: string;
  apiKeyEnvVar: string;
  defaultBaseUrl?: string;
  isCustom?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  description: string;
  maxContext: string;
  rpmFree?: number;
  tpmFree?: string;
  pricing?: string;
  isPopular?: boolean;
  isCustom?: boolean;
}

// --- Deftorch ModelConfig ---
export interface ModelConfig {
  // Common
  provider: AIProvider;
  model: AIModel;
  systemInstruction: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  // Thinking fields
  thinkingMode?: boolean;
  setThinkingBudget?: boolean;
  thinkingBudget?: number;
  // Tools
  useStructuredOutputs?: boolean;
  structuredOutputsSchema?: string;
  useCodeExecution?: boolean;
  useFunctionCalling?: boolean;
  functionCallingConfig?: string;
  useSearchGrounding?: boolean;
  useMapsGrounding?: boolean;
  useUrlContext?: boolean;
  // Advanced settings
  mediaResolution?: 'Default' | 'Low' | 'Medium' | 'High';
  safetyHarassment?: 'block_none' | 'block_few' | 'block_some' | 'block_most';
  safetyHate?: 'block_none' | 'block_few' | 'block_some' | 'block_most';
  safetySexuallyExplicit?: 'block_none' | 'block_few' | 'block_some' | 'block_most';
  safetyDangerousContent?: 'block_none' | 'block_few' | 'block_some' | 'block_most';
  stopSequences?: string[];
  outputLength?: number;
  // Speech/TTS settings
  speechVoice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  speechStyle?: 'cheerful' | 'sad' | 'excited' | 'whisper' | 'formal' | 'none';
  speechMode?: 'single' | 'multi';
  autoPlaySpeech?: boolean;
  // Composite-model / workflow routing (config/deftorch-presets.ts,
  // hooks/useChatSubmit.ts). These were already being set on the config
  // object at runtime whenever a composite model or workflow was
  // selected as the "model" — the interface just never declared them,
  // so every such assignment silently fell outside what tsc could check.
  compositeModel?: CompositeModel;
  workflow?: Workflow;
}

// --- Deftorch Agent & Composite Models ---
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  modelId: string;
  temperature: number;
  useSearchGrounding: boolean;
  useCodeExecution: boolean;
  useStructuredOutputs: boolean;
  avatar: string;
  isCustom?: boolean;
}

export interface CompositeStep {
  id: string;
  modelId: string;
  role: string;
  prompt: string;
  temperature: number;
}

export interface CompositeRouterRule {
  id: string;
  keyword: string;
  targetModelId: string;
  description: string;
}

export interface CompositeModel {
  id: string;
  name: string;
  description: string;
  strategy: 'sequential' | 'routing' | 'consensus';
  isCustom?: boolean;
  steps?: CompositeStep[];
  routerModelId?: string;
  routerRules?: CompositeRouterRule[];
  fallbackModelId?: string;
  expertModelIds?: string[];
  aggregatorModelId?: string;
}

// --- Deftorch Workflows ---
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'tool' | 'condition' | 'output';
  title: string;
  config: Record<string, any>;
  nextNodes: string[];
  position?: { x: number; y: number };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Genesis & Deftorch Unified Message ---
export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // Base64
  preview?: string; // from Genesis
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string; // Supporting both formats for transition
  // Genesis fields
  isEdited?: boolean;
  parentId?: string;
  versions?: string[];
  activeVersionIdx?: number;
  images?: ImageAttachment[]; // legacy image attachments
  // Deftorch fields
  attachments?: Attachment[];
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  agentName?: string;
  agentAvatar?: string;
}

// --- Deftorch Stream Metrics & Debug Logs ---
export interface DebugLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'in' | 'out';
  message: string;
}

export interface StreamMetrics {
  ttft: number | null; 
  duration: number | null; 
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokensPerSecond: number | null;
}

// --- Genesis Chat & Project ---
export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  modelConfig: ModelConfig;
  createdAt: Date;
  updatedAt: Date;
  summary?: string; 
  lastSummarizedIndex?: number;
  projectId?: string;
  isStarred: boolean;
  totalTokens: number;
  // new fields for agent/composite routing
  agentId?: string;
  compositeModelId?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  chatIds: string[];
  createdAt: Date;
}

// --- Genesis Artifacts ---
export type RendererType = 'p5' | 'd3' | 'svg' | 'mermaid' | 'twojs' | 'mojs' | 'pixi' | 'gsap' | 'anime' | 'lottie' | 'matter' | 'html' | 'remotion' | 'plan';

export interface Artifact {
  id: string;
  chatId: string;
  chatTitle: string;
  code: string;
  renderer: RendererType;
  createdAt: Date;
}

// --- Genesis Image Analysis (Legacy but kept) ---
export type AnalysisType = 'object-detection' | 'label-detection' | 'text-recognition' | 'face-detection' | 'landmark-recognition' | 'image-description' | 'visual-qa';

export interface BoundingBox { x: number; y: number; width: number; height: number; }
export interface Detection { label: string; confidence: number; boundingBox?: BoundingBox; }
export interface ImageAnalysisResult {
  type: AnalysisType;
  detections: Detection[];
  description?: string;
  text?: string;
  metadata?: Record<string, any>;
}
export interface ImageAttachment {
  id: string; url: string; name: string; size: number; type: string; preview?: string; analysis?: ImageAnalysisResult;
  // --- Fase D: R2 multi-modal upload fields (all optional — a plain
  // small-image attachment never touches these, see hooks/useMediaUpload.ts) ---
  /** Set while the R2 presign->PUT->complete flow is in flight. UI (ChatImagePreview,
   * the send button) should treat this attachment as not-ready-to-send until it
   * becomes 'ready' or 'error'. Absent entirely for the plain inline-base64 path. */
  uploadStatus?: 'uploading' | 'ready' | 'error';
  uploadError?: string;
  /** DB row id in media_assets — needed to reference the file from useChatSubmit. */
  mediaAssetId?: string;
  /** Gemini File API URI (files.googleapis.com/...), set once complete/route.ts
   * has relayed a large file. Only meaningful for Gemini models — see the
   * fileUri handling notes in app/api/chat/route.ts. */
  fileUri?: string;
  mimeType?: string;
  category?: 'image' | 'video' | 'audio' | 'document';
}

// --- User & Settings ---
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  createdAt: Date;
}

export interface APIKeyConfig {
  provider: AIProvider;
  key: string;
  isActive: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
  defaultModel: AIModel;
  defaultProvider: AIProvider;
  autoSave: boolean;
  showTokenCount: boolean;
  enableNotifications: boolean;
  developerMode?: boolean;
  defaultSystemInstruction?: string;
}

export interface UsageStats {
  totalTokens: number;
  totalCost: number;
  apiCalls: number;
  modelUsage: Record<string, number>;
  dailyUsage: Array<{ date: string; tokens: number; cost: number; }>;
}
