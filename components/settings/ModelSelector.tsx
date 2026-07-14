'use client';

import React from 'react';
import { ChevronDown, Sparkles, Zap, Cpu, Brain, Globe, Code, MessageSquare } from 'lucide-react';
import { AIModel, ModelConfig } from '@/types';
import { AI_MODELS } from '@/config/constants';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  value: AIModel;
  onChange: (model: AIModel) => void;
  className?: string;
}

const getModelIcon = (model: AIModel) => {
  if (model.includes('aicoding')) return <Code className="h-4 w-4" />;
  if (model.includes('claude')) return <Brain className="h-4 w-4" />;
  if (model.includes('chatgpt')) return <MessageSquare className="h-4 w-4" />;
  if (model.includes('felo')) return <Sparkles className="h-4 w-4" />;
  if (model.includes('gemini')) return <Globe className="h-4 w-4" />;
  if (model.includes('gptlogic')) return <Cpu className="h-4 w-4" />;
  if (model.includes('venice')) return <Zap className="h-4 w-4" />;
  if (model.includes('nekolabs')) return <Sparkles className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentModel = AI_MODELS[value];

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium border rounded-lg hover:bg-accent transition-colors gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {getModelIcon(value)}
          <span className="truncate">{currentModel.name}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 transition-transform shrink-0', isOpen && 'rotate-180')} />
      </button>

            {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border rounded-lg shadow-lg z-50 max-h-[400px] overflow-auto">
          <div className="p-2">
            {/* Google Gemini Models */}
            <div className="text-xs font-semibold text-muted-foreground px-3 py-2">
              GOOGLE GEMINI MODELS
            </div>
            {Object.entries(AI_MODELS)
              .filter(([key]) => key.startsWith('gemini-'))
              .map(([key, model]) => (
                <button
                  key={key}
                  onClick={() => {
                    onChange(key as AIModel);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors flex items-start gap-3',
                    value === key && 'bg-accent/50'
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {getModelIcon(key as AIModel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{model.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(model.contextWindow / 1000).toLocaleString()}K tokens • Native API
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
