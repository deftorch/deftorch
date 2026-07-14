import React, { useState } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { CompositeModel, CompositeStep, CompositeRouterRule } from '@/types';
import { Network, Plus, Edit2, Trash2, Cpu, ArrowRight, GitMerge, Settings, X, PlusCircle } from 'lucide-react';
import { DEFAULT_MODELS } from '@/config/deftorch-presets';
import { generateId } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export const ModelsView = () => {
  const { compositeModels, addCompositeModel, updateCompositeModel, deleteCompositeModel } = useChatStore();
  const [editingModel, setEditingModel] = useState<CompositeModel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingModel({
      id: generateId(),
      name: 'New Composite Pipeline',
      description: 'A custom orchestration pipeline.',
      strategy: 'routing',
      routerModelId: 'gpt-4o-mini',
      fallbackModelId: 'gpt-4o',
      routerRules: [],
      isCustom: true
    });
    setIsModalOpen(true);
  };

  const handleEdit = (model: CompositeModel) => {
    setEditingModel({ ...model });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingModel) {
      if (compositeModels.some(m => m.id === editingModel.id)) {
        updateCompositeModel(editingModel.id, editingModel);
      } else {
        addCompositeModel(editingModel);
      }
    }
    setIsModalOpen(false);
    setEditingModel(null);
  };

  const confirmDelete = () => {
    if (modelToDelete) {
      deleteCompositeModel(modelToDelete);
      setModelToDelete(null);
    }
  };

  // UI Helpers for forms
  const addStep = () => {
    if (editingModel) {
      const newStep: CompositeStep = {
        id: generateId(),
        modelId: 'gpt-4o-mini',
        role: 'Assistant',
        prompt: '',
        temperature: 0.7
      };
      setEditingModel({
        ...editingModel,
        steps: [...(editingModel.steps || []), newStep]
      });
    }
  };

  const addRule = () => {
    if (editingModel) {
      const newRule: CompositeRouterRule = {
        id: generateId(),
        keyword: '',
        targetModelId: 'gpt-4o',
        description: ''
      };
      setEditingModel({
        ...editingModel,
        routerRules: [...(editingModel.routerRules || []), newRule]
      });
    }
  };

  const removeStep = (index: number) => {
    if (editingModel && editingModel.steps) {
      const newSteps = [...editingModel.steps];
      newSteps.splice(index, 1);
      setEditingModel({ ...editingModel, steps: newSteps });
    }
  };

  const removeRule = (index: number) => {
    if (editingModel && editingModel.routerRules) {
      const newRules = [...editingModel.routerRules];
      newRules.splice(index, 1);
      setEditingModel({ ...editingModel, routerRules: newRules });
    }
  };

  const updateStep = (index: number, key: keyof CompositeStep, value: any) => {
    if (editingModel && editingModel.steps) {
      const newSteps = [...editingModel.steps];
      newSteps[index] = { ...newSteps[index], [key]: value };
      setEditingModel({ ...editingModel, steps: newSteps });
    }
  };

  const updateRule = (index: number, key: keyof CompositeRouterRule, value: any) => {
    if (editingModel && editingModel.routerRules) {
      const newRules = [...editingModel.routerRules];
      newRules[index] = { ...newRules[index], [key]: value };
      setEditingModel({ ...editingModel, routerRules: newRules });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <Network size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Composite Models
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Build custom multi-model architectures like Routing, Fallback, and Sequential Pipelines.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            Build Composite
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {compositeModels.map((model) => (
            <div
              key={model.id}
              className="p-5 glass-panel glass-panel-hover rounded-2xl flex flex-col justify-between min-h-[160px] group relative cursor-pointer"
              onClick={() => handleEdit(model)}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2 bg-[#1a6adf]/10 dark:bg-white/5 text-[#1a6adf] dark:text-[#60aaff] rounded-lg">
                    {model.strategy === 'routing' ? <GitMerge size={20} /> : model.strategy === 'sequential' ? <ArrowRight size={20} /> : <Cpu size={20} />}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono capitalize">
                    {model.strategy}
                  </span>
                </div>
                <h3 className="font-bold text-base mt-4 text-gray-800 dark:text-gray-100 group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff] transition-colors truncate">
                  {model.name}
                </h3>
                {model.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {model.description}
                  </p>
                )}
              </div>

              <div className="text-[10px] text-gray-400 mt-4 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3">
                {model.strategy === 'routing' && (
                  <div>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">Router:</span> {DEFAULT_MODELS.find(m => m.id === model.routerModelId)?.name || model.routerModelId}
                    <span className="mx-1">•</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{model.routerRules?.length || 0}</span> Rules
                  </div>
                )}
                {model.strategy === 'sequential' && (
                  <div>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{model.steps?.length || 0}</span> Sequential Steps
                  </div>
                )}
                {model.strategy !== 'routing' && model.strategy !== 'sequential' && (
                  <div>Consensus Nodes</div>
                )}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium font-mono group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff]">
                  Edit →
                </span>
              </div>

              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {model.isCustom !== false && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setModelToDelete(model.id); }}
                    className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                    title="Delete Model"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && editingModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-background border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings className="text-[#1a6adf] dark:text-[#60aaff]" />
                {compositeModels.some(m => m.id === editingModel.id) ? 'Edit Composite Model' : 'Build Composite Model'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingModel.name}
                    onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
                  <select
                    value={editingModel.strategy}
                    onChange={(e) => setEditingModel({ ...editingModel, strategy: e.target.value as any, steps: [], routerRules: [] })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] text-gray-900 dark:text-white appearance-none"
                  >
                    <option value="routing">Keyword Routing / Fallback</option>
                    <option value="sequential">Sequential (Pipeline)</option>
                    <option value="consensus">Consensus (Best-of-N)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={editingModel.description}
                  onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#1a6adf] text-gray-900 dark:text-white"
                />
              </div>

              <div className="my-6 border-b border-gray-200 dark:border-white/10" />

              {/* ROUTING STRATEGY UI */}
              {editingModel.strategy === 'routing' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Router Configuration</h3>
                  <p className="text-xs text-gray-500">The Router model will analyze the prompt and redirect it based on rules.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Router Model (Fast/Cheap LLM)</label>
                      <select
                        value={editingModel.routerModelId}
                        onChange={(e) => setEditingModel({ ...editingModel, routerModelId: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1a6adf] text-gray-900 dark:text-white appearance-none"
                      >
                        {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fallback Model (If no rule matches)</label>
                      <select
                        value={editingModel.fallbackModelId}
                        onChange={(e) => setEditingModel({ ...editingModel, fallbackModelId: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1a6adf] text-gray-900 dark:text-white appearance-none"
                      >
                        {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Routing Rules</label>
                      <button onClick={addRule} className="text-xs flex items-center gap-1 text-[#1a6adf] hover:text-[#1a6adf]/80 dark:text-[#60aaff]">
                        <PlusCircle size={14} /> Add Rule
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {editingModel.routerRules?.map((rule, idx) => (
                        <div key={rule.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                          <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] uppercase text-gray-500 mb-1">Trigger Keywords (comma separated)</label>
                                <input
                                  type="text"
                                  value={rule.keyword}
                                  onChange={(e) => updateRule(idx, 'keyword', e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#1a6adf]"
                                  placeholder="e.g. code, bug, react"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase text-gray-500 mb-1">Target Model</label>
                                <select
                                  value={rule.targetModelId}
                                  onChange={(e) => updateRule(idx, 'targetModelId', e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#1a6adf] appearance-none"
                                >
                                  {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => removeRule(idx)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {(!editingModel.routerRules || editingModel.routerRules.length === 0) && (
                        <div className="text-center p-4 border border-dashed border-gray-300 dark:border-white/20 rounded-xl text-gray-500 text-sm">
                          No rules defined. Everything will go to Fallback Model.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SEQUENTIAL STRATEGY UI */}
              {editingModel.strategy === 'sequential' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Pipeline Steps</h3>
                      <p className="text-xs text-gray-500">Define the order of execution. Output of step 1 goes to step 2.</p>
                    </div>
                    <button onClick={addStep} className="text-xs flex items-center gap-1 text-[#1a6adf] hover:text-[#1a6adf]/80 dark:text-[#60aaff] bg-blue-50 dark:bg-[#1a6adf]/10 px-2 py-1 rounded-md">
                      <PlusCircle size={14} /> Add Step
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {editingModel.steps?.map((step, idx) => (
                      <div key={step.id} className="relative p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                        {idx > 0 && (
                          <div className="absolute -top-4 left-6 text-[#1a6adf] dark:text-[#60aaff]">
                            <ArrowRight size={16} className="rotate-90" />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-bold bg-gray-200 dark:bg-white/10 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                            Step {idx + 1}
                          </span>
                          <button onClick={() => removeStep(idx)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">Model</label>
                            <select
                              value={step.modelId}
                              onChange={(e) => updateStep(idx, 'modelId', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#1a6adf] appearance-none"
                            >
                              {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">Role/Persona Title</label>
                            <input
                              type="text"
                              value={step.role}
                              onChange={(e) => updateStep(idx, 'role', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#1a6adf]"
                              placeholder="e.g. Reviewer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-gray-500 mb-1">System Instruction for this step</label>
                          <textarea
                            value={step.prompt}
                            onChange={(e) => updateStep(idx, 'prompt', e.target.value)}
                            className="w-full h-20 px-2 py-1.5 text-sm bg-white dark:bg-[#1a1525] border border-gray-200 dark:border-white/10 rounded-md focus:outline-none focus:border-[#1a6adf] resize-none"
                            placeholder="Instructions for this model..."
                          />
                        </div>
                      </div>
                    ))}
                    {(!editingModel.steps || editingModel.steps.length === 0) && (
                      <div className="text-center p-6 border border-dashed border-gray-300 dark:border-white/20 rounded-xl text-gray-500 text-sm">
                        No steps defined. Add a step to begin your pipeline.
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                disabled={!editingModel.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[#1a6adf] hover:bg-[#1a6adf]/90 dark:bg-white text-white dark:text-black dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Composite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!modelToDelete}
        onClose={() => setModelToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Composite Model"
        message="Are you sure you want to delete this composite orchestration? This action cannot be undone."
        confirmText="Delete Model"
        cancelText="Cancel"
        variant="danger"
        icon="warning"
      />
    </div>
  );
};
