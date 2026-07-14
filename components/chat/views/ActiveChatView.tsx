import React from 'react';
import { Loader2, Paperclip, ChevronDown, Send, Square, X, Pencil } from 'lucide-react';
import { MessageList } from '@/components/chat/MessageList';
import { ChatImagePreview } from '@/components/chat/ChatImagePreview';
import { ChatScrollMap } from '@/components/chat/ChatScrollMap';
import { useUIStore } from '@/lib/store/ui-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useChatStore } from '@/lib/store/chat-store';
import { useToast } from '@/lib/store/toast-store';
import { AIModel, ImageAttachment } from '@/types';
import { FILE_UPLOAD_CONFIG } from '@/config/constants';
import { DEFAULT_MODELS, PRESET_PROVIDERS } from '@/config/deftorch-presets';
import { Network, Sparkles, Brain, Cpu, Zap, Waves, Globe, Home, Bot } from 'lucide-react';

interface ActiveChatViewProps {
  messages: any[];
  isLoading: boolean;
  regeneratingId: string | null;
  onRegenerate: (messageId: string) => void;
  onSwitchVersionIdx: (messageId: string, idx: number) => void;
  onSaveMessageEdit: (messageId: string, index: number, text: string) => void;
  onStopGeneration: () => void;
  codeVersions: any[];
  
  attachedImages: ImageAttachment[];
  removeAttachedImage: (id: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement>;
  onSendMessage: () => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  
  modelDropdownRef: React.RefObject<HTMLDivElement>;
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
  selectedAgent: string | null;
  setSelectedAgent: (agentId: string | null) => void;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (open: boolean) => void;
}

export const ActiveChatView: React.FC<ActiveChatViewProps> = ({
  messages,
  isLoading,
  regeneratingId,
  onRegenerate,
  onSwitchVersionIdx,
  onSaveMessageEdit,
  onStopGeneration,
  codeVersions,
  
  attachedImages,
  removeAttachedImage,
  chatInputRef,
  onSendMessage,
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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = React.useState(false);
  const agentDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  }, [ui.inputMessage, chatInputRef]);

  return (
    <>
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto px-4 py-6" ref={scrollContainerRef}>
          <MessageList
            messages={messages}
            isLoading={isLoading}
            regeneratingId={regeneratingId}
            onRegenerate={onRegenerate}
            onSwitchVersionIdx={onSwitchVersionIdx}
            codeVersions={codeVersions}
          />
        </div>
        <ChatScrollMap containerRef={scrollContainerRef} messages={messages} />
      </div>

      <div className="border-t border-[#1e468c]/12 dark:border-white/10 p-4 flex-shrink-0 bg-transparent w-full">
        <div className="max-w-3xl mx-auto w-full">
          <div className="glass-panel w-full rounded-2xl p-4 flex flex-col focus-within:border-[#1a6adf]/45 focus-within:shadow-[0_0_0_3px_rgba(26,106,223,0.10)] dark:focus-within:border-white/20 dark:focus-within:shadow-none transition-all duration-200 shadow-sm">
            <ChatImagePreview 
              images={attachedImages} 
              onRemoveImage={removeAttachedImage} 
            />
            {ui.editingMessageId && (
              <div className="mb-2 bg-[#1a6adf]/10 dark:bg-[#60aaff]/10 border border-[#1a6adf]/20 dark:border-[#60aaff]/20 rounded-lg p-2.5 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  <span className="text-xs font-semibold text-[#1a6adf] dark:text-[#60aaff]">
                    Editing message
                  </span>
                </div>
                <button
                  onClick={() => {
                    ui.setEditingMessageId(null);
                    ui.setInputMessage('');
                    ui.setAttachedImages([]);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[#1a6adf]/20 dark:hover:bg-[#60aaff]/20 text-[#1a6adf] dark:text-[#60aaff] transition-colors cursor-pointer"
                  title="Cancel edit"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            )}
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
              className="w-full bg-transparent border-0 outline-none resize-none min-h-[36px] max-h-[50vh] text-[15px] leading-relaxed text-[#0a1628] dark:text-white placeholder-[#5580bb] dark:placeholder-gray-500 disabled:opacity-50"
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
                  <span className="text-[10px] text-gray-400">
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
                            // Auto select the model configured for this agent
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
                      {chatStore.compositeModels?.find(m => m.id === selectedModel)?.name || DEFAULT_MODELS.find(m => m.id === selectedModel)?.name || selectedModel || 'Select Model'}
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
        </div>
      </div>
    </>
  );
};
