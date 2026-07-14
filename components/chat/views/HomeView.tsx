import React from 'react';
import { ChevronDown, Loader2, Paperclip, Send, Square, Layout, Film, Image as ImageIcon, Play, Code, BarChart3, Network, PieChart, Shapes, GitFork, Clock, Sparkles, Brain, Cpu, Zap, Waves, Globe, Home, Bot } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useToast } from '@/lib/store/toast-store';
import { ChatImagePreview } from '@/components/chat/ChatImagePreview';
import { AIModel, ImageAttachment } from '@/types';
import { FILE_UPLOAD_CONFIG, AI_MODELS } from '@/config/constants';
import { DEFAULT_MODELS, PRESET_PROVIDERS } from '@/config/deftorch-presets';
import { cn } from '@/lib/utils';

interface HomeViewProps {
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  attachedImages: ImageAttachment[];
  removeAttachedImage: (id: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  onStopGeneration: () => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  modelDropdownRef: React.RefObject<HTMLDivElement>;
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
  selectedAgent: string | null;
  setSelectedAgent: (agentId: string | null) => void;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (isOpen: boolean) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  chatInputRef,
  attachedImages,
  removeAttachedImage,
  isLoading,
  onSendMessage,
  onStopGeneration,
  isUploading,
  fileInputRef,
  modelDropdownRef,
  selectedModel,
  setSelectedModel,
  selectedAgent,
  setSelectedAgent,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
}) => {
  const ui = useUIStore();
  const chatStore = useChatStore();
  const { preferences } = useSettingsStore();
  const { toast } = useToast();

  const [greeting, setGreeting] = React.useState('Welcome back');
  const [expandLevel, setExpandLevel] = React.useState(0);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = React.useState(false);
  const agentDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting('Good morning');
    else if (hrs < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  React.useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      const currentHeight = chatInputRef.current.scrollHeight;
      chatInputRef.current.style.height = `${currentHeight}px`;
      
      if (currentHeight > 90) setExpandLevel(3);
      else if (currentHeight > 68) setExpandLevel(2);
      else if (currentHeight > 48) setExpandLevel(1);
      else setExpandLevel(0);
    }
  }, [ui.inputMessage, chatInputRef]);

  const creationTools = [
    { name: 'Canvas', icon: Layout, prompt: 'Create a colorful animated canvas' },
    { name: 'Animation', icon: Film, prompt: 'Create a smooth animation' },
    { name: 'Art', icon: ImageIcon, prompt: 'Create generative art' },
    { name: 'Game', icon: Play, prompt: 'Create a simple interactive game' },
    { name: 'Pattern', icon: Code, prompt: 'Create a mesmerizing pattern' },
    {
      name: 'Bar Chart',
      icon: BarChart3,
      prompt: 'Create an interactive bar chart with sample sales data using D3.js',
    },
    {
      name: 'Network',
      icon: Network,
      prompt: 'Create a force-directed network graph using D3.js',
    },
    {
      name: 'Pie Chart',
      icon: PieChart,
      prompt: 'Create an animated pie chart with sample data using D3.js',
    },
    {
      name: 'Logo',
      icon: Shapes,
      prompt: 'Create a modern, minimalist logo design using SVG',
    },
    {
      name: 'Diagram',
      icon: GitFork,
      prompt: 'Create a simple flowchart diagram using SVG',
    },
    {
      name: 'Flowchart',
      icon: Network,
      prompt: 'Create a professional flowchart using Mermaid.js showing a business process',
    },
    {
      name: 'Sequence',
      icon: Clock,
      prompt: 'Create a sequence diagram using Mermaid.js for a system interaction',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-between md:justify-center p-4 md:p-8 md:gap-6 max-w-3xl mx-auto w-full h-full">
      <div className={cn(
        "flex flex-col items-center justify-center text-center transition-all duration-500 ease-in-out overflow-hidden",
        expandLevel >= 3 ? "opacity-0 max-h-0 m-0" : "flex-1 md:flex-initial opacity-100 max-h-[300px]"
      )}>
        <div className="flex flex-col md:flex-row items-center gap-3.5 animate-fade-in mb-2 text-center md:text-left">
          <div className="w-[38px] h-[38px] flex-shrink-0 mb-2 md:mb-0">
            <svg className="w-full h-full mx-auto md:mx-0" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="genesisGradHome" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#60aaff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path
                d="M26 16C26 21.5228 21.5228 26 16 26C10.4772 26 6 21.5228 6 16C6 10.4772 10.4772 6 16 6C19.3431 6 22.2868 7.6393 24.1002 10.1584"
                stroke="url(#genesisGradHome)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M16 16H25" stroke="url(#genesisGradHome)" strokeWidth="2.5" strokeLinecap="round" />
              <path
                d="M16 11L17.5 14.5L21 16L17.5 17.5L16 21L14.5 17.5L11 16L14.5 14.5L16 11Z"
                fill="url(#genesisGradHome)"
              />
            </svg>
          </div>
          <h1 className="font-serif text-3xl md:text-[40px] font-normal tracking-tight text-gray-900 dark:text-white leading-tight">
            {greeting}, Deft
          </h1>
        </div>
        <p className={cn(
          "hidden md:block text-gray-500 dark:text-[#b8d4ff]/80 text-center max-w-md text-sm leading-relaxed transition-all duration-500 ease-in-out overflow-hidden",
          expandLevel >= 1 ? "opacity-0 max-h-0 m-0" : "opacity-100 max-h-[60px] mb-2"
        )}>
          Mastering the Art of AI Orchestration.
        </p>
      </div>

      <div className="w-full max-w-[660px] flex flex-col items-center gap-2.5 animate-slide-up mt-auto md:mt-0">
        <div className="w-full md:hidden relative">
          <button
            onClick={() => ui.setIsMobileTemplatesOpen(!ui.isMobileTemplatesOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-[#1a6adf]/10 dark:bg-white/5 border border-[#1a6adf]/30 dark:border-white/10 rounded-xl text-xs font-semibold text-[#1a6adf] dark:text-[#b8d4ff] hover:bg-[#1a6adf]/15 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span>Getting started with a template</span>
            <ChevronDown
              size={14}
              className={`transform transition-transform duration-200 ${ui.isMobileTemplatesOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {ui.isMobileTemplatesOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => ui.setIsMobileTemplatesOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-2 z-30 bg-white/95 dark:bg-[#0f0a1e]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl max-h-60 overflow-y-auto shadow-xl p-2 animate-fade-in">
                {creationTools.map((tool, index) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        ui.setInputMessage(tool.prompt);
                        ui.setIsMobileTemplatesOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-[#1a6adf]/10 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Icon size={14} className="text-[#1a6adf] dark:text-[#60aaff] flex-shrink-0" />
                      <span>{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Main input card for home view */}
        <div className="w-full glass-panel rounded-2xl p-4 flex flex-col focus-within:border-[#1a6adf]/45 focus-within:shadow-[0_0_0_3px_rgba(26,106,223,0.10)] dark:focus-within:border-white/20 dark:focus-within:shadow-none transition-all duration-200 shadow-sm">
          <ChatImagePreview 
            images={attachedImages} 
            onRemoveImage={removeAttachedImage} 
            imageClassName="h-28 w-28 object-cover rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm"
            buttonClassName="absolute -top-2 -right-2 w-6 h-6 bg-gray-900/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          />
          <textarea
            value={ui.inputMessage}
            onChange={(e) => ui.setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) onSendMessage();
              }
            }}
            disabled={isLoading}
            placeholder="What creativity do you want to realize today?"
            className="w-full bg-transparent border-0 outline-none resize-none min-h-[44px] max-h-[60vh] text-base leading-relaxed text-[#0a1628] dark:text-white placeholder-[#5580bb] dark:placeholder-gray-500 disabled:opacity-50"
            rows={1}
            ref={chatInputRef}
          />
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1e468c]/12 dark:border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || attachedImages.length >= FILE_UPLOAD_CONFIG.maxFiles}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                title="Attach image"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>
              {attachedImages.length > 0 && (
                <span className="text-[10px] text-gray-400 font-mono">
                  {attachedImages.length}/{FILE_UPLOAD_CONFIG.maxFiles}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Agent Selector */}
              <div className="relative" ref={agentDropdownRef}>
                <button
                  onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                  disabled={isLoading}
                  className="flex items-center gap-1 bg-transparent hover:bg-[#1a6adf]/10 dark:hover:bg-white/10 rounded-lg py-1 px-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-[#0a1628] dark:hover:text-white transition-colors cursor-pointer font-medium disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    {selectedAgent 
                      ? <><Bot size={12} className="text-[#1a6adf] dark:text-[#60aaff]" /> <span className="truncate max-w-[120px]">{chatStore.agents.find(a => a.id === selectedAgent)?.name || selectedAgent}</span></>
                      : 'No Agent'}
                  </span>
                  <ChevronDown size={12} className={`stroke-[2] transition-transform ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAgentDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 max-h-[50vh] overflow-y-auto bg-white dark:bg-[#151121] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in custom-scrollbar">
                    <button
                      onClick={() => { setSelectedAgent(null); setIsAgentDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between text-xs cursor-pointer ${!selectedAgent ? 'text-[#1a6adf] dark:text-[#60aaff] font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      No Agent (Standard)
                    </button>
                    <div className="my-1 border-b border-gray-100 dark:border-white/5" />
                    {chatStore.agents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent.id);
                          if (agent.modelId) setSelectedModel(agent.modelId);
                          setIsAgentDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2 text-xs cursor-pointer ${selectedAgent === agent.id ? 'text-[#1a6adf] dark:text-[#60aaff] font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        <Bot size={14} className={selectedAgent === agent.id ? "text-[#1a6adf] dark:text-[#60aaff]" : "text-gray-400"} />
                        <span className="truncate">{agent.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-px h-3 bg-gray-300 dark:bg-gray-700" />

              {/* Model Selector */}
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  disabled={isLoading}
                  className="flex items-center gap-1 bg-transparent hover:bg-[#1a6adf]/10 dark:hover:bg-white/10 rounded-lg py-1 px-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-[#0a1628] dark:hover:text-white transition-colors cursor-pointer font-medium disabled:opacity-50"
                >
                  <span>
                    {chatStore.compositeModels?.find(m => m.id === selectedModel)?.name || chatStore.workflows.find(w => w.id === selectedModel)?.name || DEFAULT_MODELS.find(m => m.id === selectedModel)?.name || selectedModel || 'Select Model'}
                  </span>
                  <ChevronDown size={12} className={`stroke-[2] transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isModelDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 max-h-[60vh] overflow-y-auto bg-white dark:bg-[#151121] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in custom-scrollbar">
                    
                    {/* Composite Models Section */}
                    {chatStore.compositeModels && chatStore.compositeModels.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1 flex items-center gap-1">
                          <Network size={10} /> Composite (Pipelines)
                        </div>
                        {chatStore.compositeModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m.id as AIModel);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between text-xs cursor-pointer ${selectedModel === m.id ? 'text-[#1a6adf] dark:text-[#60aaff] font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            <span>{m.name}</span>
                            <span className="text-[9px] text-gray-400 capitalize">{m.strategy}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Workflows Section */}
                    {chatStore.workflows && chatStore.workflows.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1 text-[10px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1 flex items-center gap-1">
                          <Network size={10} /> Workflows
                        </div>
                        {chatStore.workflows.map((wf) => (
                          <button
                            key={wf.id}
                            onClick={() => {
                              setSelectedModel(wf.id as AIModel);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between text-xs cursor-pointer ${selectedModel === wf.id ? 'text-[#1a6adf] dark:text-[#60aaff] font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            <span>{wf.name}</span>
                            <span className="text-[9px] text-gray-400">{wf.nodes.length} nodes</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {PRESET_PROVIDERS.map(provider => {
                      const providerModels = DEFAULT_MODELS.filter(m => m.providerId === provider.id);
                      if (providerModels.length === 0) return null;
                      
                      return (
                        <div key={provider.id} className="mb-2 last:mb-0">
                          <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1 flex items-center gap-1.5">
                            {provider.id === 'google' && <Sparkles size={12} className="text-blue-500" />}
                            {provider.id === 'openai' && <Brain size={12} className="text-green-500" />}
                            {provider.id === 'anthropic' && <Cpu size={12} className="text-purple-500" />}
                            {provider.id === 'groq' && <Zap size={12} className="text-orange-500" />}
                            {provider.id === 'deepseek' && <Waves size={12} className="text-blue-400" />}
                            {provider.id === 'openrouter' && <Globe size={12} className="text-indigo-400" />}
                            {provider.id === 'ollama' && <Home size={12} className="text-gray-500" />}
                            {['google', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama'].indexOf(provider.id) === -1 && <Bot size={12} className="text-gray-400" />}
                            {provider.name}
                          </div>
                          {providerModels.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id as AIModel);
                                setIsModelDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between text-xs cursor-pointer ${selectedModel === m.id ? 'text-[#1a6adf] dark:text-[#60aaff] font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                              <span>{m.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isLoading ? (
                <button
                  onClick={() => onStopGeneration()}
                  className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                  title="Stop generating"
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => onSendMessage()}
                  disabled={!ui.inputMessage.trim() && attachedImages.length === 0}
                  className="p-2.5 bg-[#1a6adf] dark:bg-white text-white dark:text-black hover:opacity-95 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  title="Send message"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick template pills for desktop view */}
        <div className={cn(
          "hidden md:flex flex-wrap justify-center gap-2 w-full select-none transition-all duration-500 ease-in-out overflow-hidden",
          expandLevel >= 2 ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-[200px] mt-2"
        )}>
          {creationTools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  ui.setInputMessage(tool.prompt);
                  setTimeout(() => chatInputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/60 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-[#1a6adf]/40 dark:hover:border-[#60aaff]/30 rounded-full transition-all cursor-pointer hover:bg-[#1a6adf]/8 dark:hover:bg-[#60aaff]/8 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Icon size={13} className="text-[#1a6adf] dark:text-[#60aaff]" />
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {tool.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
