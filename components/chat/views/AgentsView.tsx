import React, { useState } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { Agent } from '@/types';
import { Users, Plus, Edit2, Trash2, Bot, Code, Search, Braces, Sparkles, X, Globe, Terminal, Settings } from 'lucide-react';
import { DEFAULT_MODELS } from '@/config/deftorch-presets';
import { generateId } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export const AgentsView = () => {
  const { agents, addAgent, updateAgent, deleteAgent } = useChatStore();
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  // Search Grounding & Code Execution are implemented server-side only for the
  // Gemini branch of app/api/chat/route.ts. For any other provider these toggles
  // are currently a no-op, so the form must reflect that instead of hiding it.
  const isGeminiModel = !!editingAgent?.modelId.startsWith('gemini-');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingAgent({
      id: generateId(),
      name: 'New Agent',
      description: 'A helpful assistant.',
      systemInstruction: 'You are a helpful assistant.',
      modelId: 'gemini-3.5-flash',
      temperature: 0.7,
      useSearchGrounding: false,
      useCodeExecution: false,
      useStructuredOutputs: false,
      avatar: '🤖',
      isCustom: true
    });
    setIsModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent({ ...agent });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingAgent) {
      if (agents.some(a => a.id === editingAgent.id)) {
        updateAgent(editingAgent.id, editingAgent);
      } else {
        addAgent(editingAgent);
      }
    }
    setIsModalOpen(false);
    setEditingAgent(null);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete);
      setAgentToDelete(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Bot size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Agents (Personas)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage specialized AI agents with unique system instructions and tool capabilities.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            Create Agent
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-5 glass-panel glass-panel-hover rounded-2xl flex flex-col justify-between min-h-[160px] group relative cursor-pointer"
              onClick={() => handleEdit(agent)}
            >
              <div>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="w-10 h-10 rounded-xl bg-[#1a6adf]/10 dark:bg-white/5 border border-[#1a6adf]/20 dark:border-white/10 flex items-center justify-center">
                    <Bot size={20} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  </div>
                </div>
                <h3 className="font-bold text-base mt-4 text-gray-800 dark:text-gray-100 group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff] transition-colors truncate">
                  {agent.name}
                </h3>
                <p className="text-[10px] text-[#1a6adf] dark:text-[#60aaff] font-mono mt-1">
                  {DEFAULT_MODELS.find(m => m.id === agent.modelId)?.name || agent.modelId}
                </p>
                {agent.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {agent.description}
                  </p>
                )}
              </div>

              <div className="text-[10px] text-gray-400 mt-4 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3">
                <div className="flex items-center gap-1">
                  {agent.useSearchGrounding && <span title="Web Search Enabled"><Globe size={14} className="text-[#1a6adf] dark:text-[#60aaff]" aria-label="Web Search Enabled" /></span>}
                  {agent.useCodeExecution && <span title="Code Execution Enabled"><Terminal size={14} className="text-[#1a6adf] dark:text-[#60aaff]" aria-label="Code Execution Enabled" /></span>}
                  {agent.useStructuredOutputs && <span title="JSON Output Enabled"><Braces size={14} className="text-[#1a6adf] dark:text-[#60aaff]" aria-label="JSON Output Enabled" /></span>}
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium font-mono group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff]">
                  Edit →
                </span>
              </div>

              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {agent.isCustom !== false && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAgentToDelete(agent.id); }}
                    className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && editingAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-background border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings className="text-[#1a6adf] dark:text-[#60aaff]" />
                {agents.some(a => a.id === editingAgent.id) ? 'Edit Agent' : 'Create Agent'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] dark:focus:border-[#60aaff] text-gray-900 dark:text-white"
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={editingAgent.description}
                  onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] dark:focus:border-[#60aaff] text-gray-900 dark:text-white"
                  placeholder="Short description of what this agent does..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  System Instructions
                  <span className="text-xs font-normal text-gray-500">Defines the core persona and rules</span>
                </label>
                <textarea
                  value={editingAgent.systemInstruction}
                  onChange={(e) => setEditingAgent({ ...editingAgent, systemInstruction: e.target.value })}
                  className="w-full h-32 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] dark:focus:border-[#60aaff] text-gray-900 dark:text-white resize-none"
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Underlying Model</label>
                  <select
                    value={editingAgent.modelId}
                    onChange={(e) => {
                      const newModelId = e.target.value;
                      const stillGemini = newModelId.startsWith('gemini-');
                      setEditingAgent({
                        ...editingAgent,
                        modelId: newModelId,
                        // Search Grounding & Code Execution are Gemini-only tools. Silently
                        // keeping them checked against a non-Gemini model gave no error and
                        // no effect at request time — reset them here instead so the UI never
                        // implies a capability that the backend will quietly ignore.
                        useSearchGrounding: stillGemini ? editingAgent.useSearchGrounding : false,
                        useCodeExecution: stillGemini ? editingAgent.useCodeExecution : false,
                      });
                    }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] dark:focus:border-[#60aaff] text-gray-900 dark:text-white appearance-none"
                  >
                    {DEFAULT_MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                    Temperature <span>{editingAgent.temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={editingAgent.temperature}
                    onChange={(e) => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Capabilities</label>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 border border-gray-200 dark:border-white/10 rounded-xl transition-colors ${isGeminiModel ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : 'opacity-50 cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={editingAgent.useSearchGrounding}
                      disabled={!isGeminiModel}
                      onChange={(e) => setEditingAgent({ ...editingAgent, useSearchGrounding: e.target.checked })}
                      className="w-4 h-4 text-[#1a6adf] rounded border-gray-300 focus:ring-[#1a6adf] disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <Search size={14} className="text-blue-500" /> Web Search Grounding
                      </div>
                      <div className="text-xs text-gray-500">
                        {isGeminiModel
                          ? 'Allow agent to search the internet for real-time information.'
                          : 'Requires a Gemini model — not supported by the currently selected model.'}
                      </div>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-3 border border-gray-200 dark:border-white/10 rounded-xl transition-colors ${isGeminiModel ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : 'opacity-50 cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={editingAgent.useCodeExecution}
                      disabled={!isGeminiModel}
                      onChange={(e) => setEditingAgent({ ...editingAgent, useCodeExecution: e.target.checked })}
                      className="w-4 h-4 text-[#1a6adf] rounded border-gray-300 focus:ring-[#1a6adf] disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <Code size={14} className="text-green-500" /> Advanced Code Execution
                      </div>
                      <div className="text-xs text-gray-500">
                        {isGeminiModel
                          ? 'Agent can run Python code sandbox for math and logic tasks.'
                          : 'Requires a Gemini model — not supported by the currently selected model.'}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-white/10 rounded-xl opacity-50 cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      className="w-4 h-4 text-[#1a6adf] rounded border-gray-300 focus:ring-[#1a6adf] disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <Braces size={14} className="text-purple-500" /> Force Structured JSON
                        <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">Coming soon</span>
                      </div>
                      <div className="text-xs text-gray-500">Not implemented yet on any provider — planned as part of the AI SDK migration.</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editingAgent.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[#1a6adf] hover:bg-[#1a6adf]/90 dark:bg-white text-white dark:text-black dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!agentToDelete}
        onClose={() => setAgentToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? This action cannot be undone."
        confirmText="Delete Agent"
        cancelText="Cancel"
        variant="danger"
        icon="warning"
      />
    </div>
  );
};
