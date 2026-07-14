import React, { useState } from 'react';
import { useChatStore } from '@/lib/store/chat-store';
import { Workflow, WorkflowNode } from '@/types';
import { GitPullRequest, Plus, Edit2, Trash2, Settings, X, ArrowRight, Play, Server, Bot, Search, FileOutput } from 'lucide-react';
import { generateId } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui/confirm-modal';

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'trigger': return <Play size={16} className="text-green-500" />;
    case 'tool': return <Search size={16} className="text-blue-500" />;
    case 'agent': return <Bot size={16} className="text-purple-500" />;
    case 'condition': return <GitPullRequest size={16} className="text-orange-500" />;
    case 'output': return <FileOutput size={16} className="text-red-500" />;
    default: return <Server size={16} />;
  }
};

const getNodeColor = (type: string) => {
  switch (type) {
    case 'trigger': return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400';
    case 'tool': return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'agent': return 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400';
    case 'condition': return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400';
    case 'output': return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400';
    default: return 'border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400';
  }
};

export const WorkflowsView = () => {
  const { workflows, addWorkflow, updateWorkflow, deleteWorkflow } = useChatStore();
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingWorkflow({
      id: generateId(),
      name: 'New Workflow',
      description: 'A custom agentic pipeline.',
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [
        { id: generateId(), type: 'trigger', title: 'Start', config: {}, nextNodes: [] }
      ]
    });
    setSelectedNodeId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (wf: Workflow) => {
    setEditingWorkflow({ ...wf });
    setSelectedNodeId(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingWorkflow) {
      if (workflows.some(w => w.id === editingWorkflow.id)) {
        updateWorkflow(editingWorkflow.id, editingWorkflow);
      } else {
        addWorkflow(editingWorkflow);
      }
    }
    setIsModalOpen(false);
    setEditingWorkflow(null);
  };

  const confirmDelete = () => {
    if (workflowToDelete) {
      deleteWorkflow(workflowToDelete);
      setWorkflowToDelete(null);
    }
  };

  const addNode = (type: WorkflowNode['type']) => {
    if (!editingWorkflow) return;
    const newNode: WorkflowNode = {
      id: generateId(),
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      config: {},
      nextNodes: []
    };
    
    // Automatically connect from the last node if possible
    const newNodes = [...editingWorkflow.nodes];
    if (newNodes.length > 0) {
      const lastNode = newNodes[newNodes.length - 1];
      lastNode.nextNodes.push(newNode.id);
    }
    newNodes.push(newNode);
    
    setEditingWorkflow({ ...editingWorkflow, nodes: newNodes });
    setSelectedNodeId(newNode.id);
  };

  const removeNode = (id: string) => {
    if (!editingWorkflow) return;
    let newNodes = editingWorkflow.nodes.filter(n => n.id !== id);
    // Remove references to this node
    newNodes = newNodes.map(n => ({
      ...n,
      nextNodes: n.nextNodes.filter(nextId => nextId !== id)
    }));
    setEditingWorkflow({ ...editingWorkflow, nodes: newNodes });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNode = (id: string, updates: Partial<WorkflowNode>) => {
    if (!editingWorkflow) return;
    const newNodes = editingWorkflow.nodes.map(n => n.id === id ? { ...n, ...updates } : n);
    setEditingWorkflow({ ...editingWorkflow, nodes: newNodes });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
              <GitPullRequest size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
              Workflows (Pipelines)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Design complex multi-step orchestrations connecting agents, tools, and custom logic.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            Build Workflow
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-5 glass-panel glass-panel-hover rounded-2xl flex flex-col justify-between min-h-[160px] group relative cursor-pointer"
              onClick={() => handleEdit(wf)}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2 bg-[#1a6adf]/10 dark:bg-white/5 text-[#1a6adf] dark:text-[#60aaff] rounded-lg">
                    <GitPullRequest size={20} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {wf.nodes.length} nodes
                  </span>
                </div>
                <h3 className="font-bold text-base mt-4 text-gray-800 dark:text-gray-100 group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff] transition-colors truncate">
                  {wf.name}
                </h3>
                {wf.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {wf.description}
                  </p>
                )}
              </div>

              {/* Mini visualization */}
              <div className="text-[10px] text-gray-400 mt-4 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3">
                <div className="flex items-center gap-1">
                  {wf.nodes.slice(0, 4).map((node, idx) => (
                    <React.Fragment key={node.id}>
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-[4px] border ${getNodeColor(node.type)}`} title={node.title}>
                        {getNodeIcon(node.type)}
                      </div>
                      {idx < Math.min(wf.nodes.length - 1, 3) && (
                        <div className="w-2 h-[1px] bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                  {wf.nodes.length > 4 && (
                    <>
                      <div className="w-2 h-[1px] bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                      <span className="text-[10px] text-gray-400">+{wf.nodes.length - 4}</span>
                    </>
                  )}
                </div>
                
                <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium font-mono group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff]">
                  Edit →
                </span>
              </div>

              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setWorkflowToDelete(wf.id); }}
                  className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                  title="Delete Workflow"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && editingWorkflow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-background border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3 w-1/2">
                <GitPullRequest className="text-[#1a6adf] dark:text-[#60aaff]" />
                <input 
                  type="text" 
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow({...editingWorkflow, name: e.target.value})}
                  className="font-bold text-lg text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-full"
                  placeholder="Workflow Name"
                />
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Canvas Area */}
              <div className="flex-1 bg-gray-50 dark:bg-black/20 p-6 overflow-x-auto relative flex flex-col items-start justify-center min-w-0">
                <div className="flex items-center justify-start min-h-[300px] w-max gap-4 pb-12 px-10">
                  {editingWorkflow.nodes.map((node, index) => (
                    <React.Fragment key={node.id}>
                      <div 
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`w-48 bg-white dark:bg-[#201b2d] rounded-xl shadow-sm border-2 cursor-pointer transition-all hover:-translate-y-1 ${selectedNodeId === node.id ? 'border-[#1a6adf] dark:border-[#60aaff] shadow-md' : 'border-transparent dark:border-white/10'}`}
                      >
                        <div className={`px-3 py-2 border-b flex items-center gap-2 rounded-t-xl ${getNodeColor(node.type)}`}>
                          {getNodeIcon(node.type)}
                          <span className="text-xs font-bold uppercase tracking-wider">{node.type}</span>
                        </div>
                        <div className="p-3">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">{node.title}</div>
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {Object.keys(node.config).length} config keys
                          </div>
                        </div>
                      </div>

                      {index < editingWorkflow.nodes.length - 1 && (
                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                          <div className="w-8 h-[2px] bg-current" />
                          <ArrowRight size={16} className="-ml-1" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Add Node Button in Flow */}
                  {editingWorkflow.nodes.length > 0 && (
                    <>
                      <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
                        <div className="w-8 h-[2px] bg-current stroke-dashed" />
                        <ArrowRight size={16} className="-ml-1" />
                      </div>
                      <div className="relative group">
                        <button className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-[#1a6adf] hover:border-[#1a6adf] transition-colors">
                          <Plus size={20} />
                        </button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-[#2a2438] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl p-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10 w-32">
                          <button onClick={() => addNode('tool')} className="text-xs text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded">Add Tool</button>
                          <button onClick={() => addNode('agent')} className="text-xs text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded">Add Agent</button>
                          <button onClick={() => addNode('condition')} className="text-xs text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded">Add Condition</button>
                          <button onClick={() => addNode('output')} className="text-xs text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded">Add Output</button>
                        </div>
                      </div>
                    </>
                  )}
                  {editingWorkflow.nodes.length === 0 && (
                    <button onClick={() => addNode('trigger')} className="px-4 py-2 bg-[#1a6adf] text-white rounded-lg text-sm">
                      Add Trigger
                    </button>
                  )}
                </div>
              </div>

              {/* Sidebar Config Panel */}
              <div className="w-80 border-l border-gray-200 dark:border-white/10 flex flex-col bg-white dark:bg-[#1a1525]">
                {selectedNodeId ? (() => {
                  const node = editingWorkflow.nodes.find(n => n.id === selectedNodeId);
                  if (!node) return null;
                  return (
                    <>
                      <div className={`p-4 border-b ${getNodeColor(node.type)} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          {getNodeIcon(node.type)}
                          <span className="font-semibold uppercase tracking-wider text-sm">{node.type} Node</span>
                        </div>
                        <button onClick={() => removeNode(node.id)} className="p-1 hover:bg-white/20 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                          <input 
                            type="text" 
                            value={node.title} 
                            onChange={(e) => updateNode(node.id, { title: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1a6adf]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Configuration (JSON)</label>
                          <textarea 
                            value={JSON.stringify(node.config, null, 2)} 
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                updateNode(node.id, { config: parsed });
                              } catch (e) {
                                // Ignore parse errors while typing
                              }
                            }}
                            className="w-full h-48 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1a6adf] resize-none"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Must be valid JSON.</p>
                        </div>
                      </div>
                    </>
                  );
                })() : (
                  <div className="p-6 flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                    <Settings size={32} className="mb-3 opacity-20" />
                    <p className="text-sm">Select a node in the canvas to edit its configuration.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!editingWorkflow.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[#1a6adf] hover:bg-[#1a6adf]/90 dark:bg-white text-white dark:text-black dark:hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!workflowToDelete}
        onClose={() => setWorkflowToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Workflow"
        message="Are you sure you want to delete this workflow? This action cannot be undone."
        confirmText="Delete Workflow"
        cancelText="Cancel"
        variant="danger"
        icon="warning"
      />
    </div>
  );
};
