import React from 'react';
import { FolderOpen, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useChatStore } from '@/lib/store/chat-store';
import { useUIStore } from '@/lib/store/ui-store';
import { formatDate } from '@/lib/utils';
import { useChatNavigation } from '@/hooks/useChatNavigation';

interface ProjectsViewProps {
  setNewProjectName: (name: string) => void;
  setNewProjectDesc: (desc: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  setNewProjectName,
  setNewProjectDesc,
}) => {
  const { selectChat: onSelectChat } = useChatNavigation();
  const chatStore = useChatStore();
  const ui = useUIStore();

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-fade-in bg-transparent">
      <div className="max-w-5xl mx-auto">
        {ui.activeProjectId ? (
          <div>
            <button
              onClick={() => ui.setActiveProjectId(null)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6 cursor-pointer"
            >
              ← Back to Projects
            </button>

            {(() => {
              const project = chatStore.projects.find((p) => p.id === ui.activeProjectId);
              if (!project) return null;

              const projectChats = chatStore.chats.filter((c) => c.projectId === project.id);

              return (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-200 dark:border-white/10 pb-6">
                    <div>
                      <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
                        <FolderOpen className="text-[#1a6adf] dark:text-[#60aaff]" size={28} />
                        {project.name}
                      </h1>
                      {project.description && (
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-2xl">
                          {project.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Created on {formatDate(project.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newChatId = chatStore.createChat(`New Chat in ${project.name}`);
                          chatStore.moveToProject(newChatId, project.id);
                          ui.setActiveChatId(newChatId);
                          ui.setCurrentView('chat');
                          ui.setP5Code('');
                          ui.setEditableCode('');
                          ui.setShowArtifact(false);
                        }}
                        className="px-4 py-2 bg-[#1a6adf] hover:bg-[#1a6adf]/90 dark:bg-white text-white dark:text-black dark:hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Plus size={16} /> New Chat in Project
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to delete this project? The chats inside will not be deleted.'
                            )
                          ) {
                            chatStore.deleteProject(project.id);
                            ui.setActiveProjectId(null);
                          }
                        }}
                        className="p-2 border border-red-200 dark:border-red-950/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {projectChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <MessageSquare size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                      <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                        No chats in this project yet
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Create a new chat above to start working on this project.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projectChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => onSelectChat(chat.id)}
                          className="p-4 glass-panel glass-panel-hover rounded-xl cursor-pointer flex flex-col justify-between h-32 animate-fade-in"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm truncate text-gray-800 dark:text-gray-200">
                                {chat.title}
                              </h3>
                              <span className="text-[10px] bg-gray-100 dark:bg-white/5 text-gray-500 px-1.5 py-0.5 rounded">
                                {chat.messages.length} msgs
                              </span>
                            </div>
                            {chat.summary && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                {chat.summary}
                              </p>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-2">
                            Last active: {formatDate(chat.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
                  <FolderOpen size={28} className="text-[#1a6adf] dark:text-[#60aaff]" />
                  Projects
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Organize your creative visual workspaces
                </p>
              </div>

              <button
                onClick={() => {
                  setNewProjectName('');
                  setNewProjectDesc('');
                  ui.setIsCreateProjectOpen(true);
                }}
                className="px-4 py-2 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium shadow-sm"
              >
                <Plus size={18} /> New Project
              </button>
            </div>

            {chatStore.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <FolderOpen size={64} className="text-gray-400 dark:text-gray-700 mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-400 mb-2">
                  No projects yet
                </h2>
                <p className="text-gray-500 dark:text-gray-500 text-sm max-w-sm">
                  Create a project to group related codes, visual canvases, and chat conversations.
                </p>
                <button
                  onClick={() => {
                    setNewProjectName('');
                    setNewProjectDesc('');
                    ui.setIsCreateProjectOpen(true);
                  }}
                  className="mt-6 px-6 py-3 bg-[#1a6adf] dark:bg-white text-white dark:text-black rounded-xl hover:bg-[#1a6adf]/90 dark:hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer text-sm font-medium"
                >
                  <Plus size={18} /> Create First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {chatStore.projects.map((project) => {
                  const projectChatsCount = chatStore.chats.filter((c) => c.projectId === project.id).length;
                  return (
                    <div
                      key={project.id}
                      onClick={() => ui.setActiveProjectId(project.id)}
                      className="p-5 glass-panel glass-panel-hover rounded-2xl cursor-pointer flex flex-col justify-between min-h-[160px] group relative"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="p-2 bg-[#1a6adf]/10 dark:bg-white/5 text-[#1a6adf] dark:text-[#60aaff] rounded-lg">
                            <FolderOpen size={20} />
                          </div>
                          <span className="text-[10px] text-gray-400 group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff] transition-colors font-mono">
                            {projectChatsCount} chat{projectChatsCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <h3 className="font-bold text-base mt-4 text-gray-800 dark:text-gray-100 group-hover:text-[#1a6adf] dark:group-hover:text-[#60aaff] transition-colors truncate">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>

                      <div className="text-[10px] text-gray-400 mt-4 flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3">
                        <span>Created: {formatDate(project.createdAt)}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium font-mono">
                          Open →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
