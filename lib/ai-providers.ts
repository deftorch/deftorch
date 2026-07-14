import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { DEFAULT_MODELS } from '@/config/deftorch-presets';

/**
 * Unified non-Gemini provider resolution via the Vercel AI SDK.
 *
 * This replaces the old hand-rolled `fetch()` call to OpenRouter that used to
 * live in app/api/chat/route.ts. Two concrete improvements over the old code:
 *
 * 1. Providers are called DIRECTLY with the user's own (or server) API key —
 *    OpenRouter is no longer a mandatory middleman for every non-Gemini
 *    request. This removes the shared-server-key-abuse risk flagged in the
 *    earlier security review (anyone could burn the operator's OpenRouter
 *    quota just by chatting with GPT-4o/Claude/Llama).
 * 2. One function handles every provider instead of duplicated per-provider
 *    branching — adding a new provider means adding one entry to
 *    PROVIDER_MODEL_MAP, not a new `if` block with its own fetch/parsing
 *    logic.
 *
 * OpenRouter is kept ONLY as an explicit fallback for models that aren't in
 * DEFAULT_MODELS (e.g. someone wants to try a model Deftorch hasn't been
 * taught about yet) — see resolveNonGeminiModel() below.
 */

// Deftorch's internal model id -> real upstream model id per provider.
// Mirrors the old modelIdMap/openRouterModelMap that used to live in route.ts.
const OPENAI_MODEL_MAP: Record<string, string> = {
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'o3-mini': 'o3-mini',
};

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
};

const GROQ_MODEL_MAP: Record<string, string> = {
  'llama-3.3-70b-specdec': 'llama-3.3-70b-specdec',
};

// DeepSeek's API is OpenAI-compatible, so it's served through the OpenAI
// provider pointed at DeepSeek's base URL rather than a dedicated package.
const DEEPSEEK_MODEL_MAP: Record<string, string> = {
  'deepseek-chat': 'deepseek-chat',
  'deepseek-reasoner': 'deepseek-reasoner',
};

export interface ProvidersConfig {
  openai?: { apiKey?: string };
  anthropic?: { apiKey?: string };
  groq?: { apiKey?: string };
  deepseek?: { apiKey?: string };
  openrouter?: { apiKey?: string };
}

export interface ResolvedNonGeminiModel {
  providerId: 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter';
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  /** Whether this provider supports a JSON-mode response format for useStructuredOutputs. */
  supportsJsonMode: boolean;
}

/**
 * Resolves a Deftorch model id to a ready-to-use AI SDK LanguageModel,
 * preferring a direct provider call and only falling back to OpenRouter
 * for models Deftorch doesn't have an explicit mapping for.
 *
 * Throws if the required API key (BYOK or server env var) is missing —
 * the caller is expected to turn that into a 400 response, same as before.
 */
export function resolveNonGeminiModel(targetModel: string, providersConfig?: ProvidersConfig) {
  const info = DEFAULT_MODELS.find((m) => m.id === targetModel);
  const providerId = info?.providerId;

  if (providerId === 'openai' || (!providerId && OPENAI_MODEL_MAP[targetModel])) {
    const apiKey = providersConfig?.openai?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key is not configured (BYOK or OPENAI_API_KEY).');
    const openai = createOpenAI({ apiKey });
    return {
      providerId: 'openai' as const,
      model: openai(OPENAI_MODEL_MAP[targetModel] || targetModel),
      supportsJsonMode: true,
    };
  }

  if (providerId === 'anthropic' || (!providerId && ANTHROPIC_MODEL_MAP[targetModel])) {
    const apiKey = providersConfig?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Anthropic API key is not configured (BYOK or ANTHROPIC_API_KEY).');
    const anthropic = createAnthropic({ apiKey });
    return {
      providerId: 'anthropic' as const,
      model: anthropic(ANTHROPIC_MODEL_MAP[targetModel] || targetModel),
      // Claude doesn't have a dedicated "JSON mode" the way OpenAI/Gemini do;
      // structured output there relies on tool-forcing, which is out of scope
      // for this pass. Flagged false so the caller falls back to prompt-based
      // instruction instead of a provider option that doesn't exist.
      supportsJsonMode: false,
    };
  }

  if (providerId === 'groq' || (!providerId && GROQ_MODEL_MAP[targetModel])) {
    const apiKey = providersConfig?.groq?.apiKey || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Groq API key is not configured (BYOK or GROQ_API_KEY).');
    const groq = createGroq({ apiKey });
    return {
      providerId: 'groq' as const,
      model: groq(GROQ_MODEL_MAP[targetModel] || targetModel),
      supportsJsonMode: true,
    };
  }

  if (providerId === 'deepseek' || (!providerId && DEEPSEEK_MODEL_MAP[targetModel])) {
    const apiKey = providersConfig?.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DeepSeek API key is not configured (BYOK or DEEPSEEK_API_KEY).');
    const deepseek = createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
    return {
      providerId: 'deepseek' as const,
      model: deepseek(DEEPSEEK_MODEL_MAP[targetModel] || targetModel),
      supportsJsonMode: true,
    };
  }

  // Fallback: unknown model id, not explicitly mapped to any direct provider.
  // Route it through OpenRouter as a catch-all rather than failing outright.
  const openRouterKey = providersConfig?.openrouter?.apiKey || process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error(`Unrecognized model "${targetModel}" and no OpenRouter API key configured as fallback.`);
  }
  const openrouter = createOpenAI({
    apiKey: openRouterKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: { 'HTTP-Referer': 'https://deftorch.com', 'X-Title': 'Deftorch' },
  });
  return {
    providerId: 'openrouter' as const,
    model: openrouter(targetModel),
    supportsJsonMode: true,
  };
}
