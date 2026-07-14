import { Agent, CompositeModel, ModelInfo, ProviderInfo, Workflow } from '@/types';

export const PRESET_PROVIDERS: ProviderInfo[] = [
  { id: 'google', name: 'Google AI Studio', logo: '🤖', description: 'Gemini models', apiKeyEnvVar: 'GEMINI_API_KEY' },
  { id: 'openai', name: 'OpenAI', logo: '🧠', description: 'GPT models', apiKeyEnvVar: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic Claude', logo: '🦉', description: 'Claude models', apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  { id: 'groq', name: 'Groq Cloud', logo: '⚡', description: 'Fast LPU models', apiKeyEnvVar: 'GROQ_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', logo: '🐋', description: 'DeepSeek models', apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', logo: '🌐', description: 'Multi-provider routing', apiKeyEnvVar: 'OPENROUTER_API_KEY' },
  { id: 'ollama', name: 'Ollama (Lokal)', logo: '🏠', description: 'Local models', apiKeyEnvVar: 'OLLAMA_API_KEY' }
];

export const DEFAULT_MODELS: ModelInfo[] = [
  // Google
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', providerId: 'google', description: '', maxContext: '1M' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', providerId: 'google', description: '', maxContext: '2M' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', providerId: 'google', description: '', maxContext: '1M' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', description: '', maxContext: '128k' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', description: '', maxContext: '128k' },
  { id: 'o3-mini', name: 'o3-mini', providerId: 'openai', description: '', maxContext: '200k' },
  // Anthropic
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', description: '', maxContext: '200k' },
  // Groq
  { id: 'llama-3.3-70b-specdec', name: 'LLaMA 3.3 70B', providerId: 'groq', description: '', maxContext: '128k' },
  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek V3', providerId: 'deepseek', description: '', maxContext: '64k' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', providerId: 'deepseek', description: '', maxContext: '64k' }
];

export const PRESET_AGENTS: Agent[] = [
  {
    id: 'web-researcher',
    name: 'Peneliti Web Real-time',
    description: 'Melakukan penelusuran web menggunakan Google Search Grounding untuk informasi paling baru.',
    modelId: 'gemini-3.5-flash',
    systemInstruction: 'Anda adalah agen peneliti web profesional dan analitis.',
    temperature: 0.5,
    useSearchGrounding: true,
    useCodeExecution: false,
    useStructuredOutputs: false,
    avatar: '🔍'
  },
  {
    id: 'code-executor',
    name: 'Analis Kode & Matematika',
    description: 'Menyelesaikan koding, perhitungan, dan analisis data dengan mengeksekusi kode Python.',
    modelId: 'gemini-3.5-flash',
    systemInstruction: 'Anda adalah asisten pemrograman dan matematika tingkat lanjut yang memiliki akses ke modul eksekusi kode (Python sandbox).',
    temperature: 0.2,
    useSearchGrounding: false,
    useCodeExecution: true,
    useStructuredOutputs: false,
    avatar: '🧮'
  }
];

export const PRESET_COMPOSITES: CompositeModel[] = [
  {
    id: 'router-basic',
    name: 'Smart Router (Basic)',
    description: 'Rute otomatis berdasarkan keyword ke model spesifik (Code -> LLaMA, Default -> GPT-4o)',
    strategy: 'routing',
    routerModelId: 'gpt-4o-mini',
    fallbackModelId: 'gpt-4o',
    routerRules: [
      { id: '1', keyword: 'code, python, react', targetModelId: 'llama-3.3-70b-specdec', description: 'Coding tasks' }
    ],
    isCustom: false
  },
  {
    id: 'sequential-reviewer',
    name: 'Draft & Review Pipeline',
    description: 'Claude 3.5 menulis draft, lalu GPT-4o me-review dan memperbaiki hasilnya.',
    strategy: 'sequential',
    steps: [
      { id: 'step-1', modelId: 'claude-3-5-sonnet', role: 'Drafter', prompt: 'Write a comprehensive draft about the following topic:', temperature: 0.7 },
      { id: 'step-2', modelId: 'gpt-4o', role: 'Reviewer', prompt: 'Review and improve this draft. Make it professional and concise:', temperature: 0.3 }
    ],
    isCustom: false
  }
];

export const PRESET_WORKFLOWS: Workflow[] = [
  {
    id: 'research-pipeline',
    name: 'Deep Research Pipeline',
    description: 'Pipeline otomatis: Terima input -> Cari Web -> Analisis -> Output Laporan',
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes: [
      { id: 'n1', type: 'trigger', title: 'User Input', config: {}, nextNodes: ['n2'], position: { x: 50, y: 150 } },
      { id: 'n2', type: 'tool', title: 'Web Search', config: { queryTemplate: '{{input}}' }, nextNodes: ['n3'], position: { x: 300, y: 150 } },
      { id: 'n3', type: 'agent', title: 'Research Analyst', config: { agentId: 'web-researcher' }, nextNodes: ['n4'], position: { x: 550, y: 150 } },
      { id: 'n4', type: 'output', title: 'Final Report', config: {}, nextNodes: [], position: { x: 800, y: 150 } }
    ]
  }
];
