import { AIModel } from '@/types';
import { AI_MODELS } from '@/config/constants';

export interface ModelGroup {
  label: string;
  models: { key: AIModel; name: string }[];
}

export function getGroupedModels(): ModelGroup[] {
  const googleModels = Object.entries(AI_MODELS)
    .filter(([key]) => key.startsWith('gemini-'))
    .map(([key, model]) => ({ key: key as AIModel, name: model.name }));

  return [
    { label: 'Google Gemini', models: googleModels },
  ];
}

export function getAllAvailableModels(): AIModel[] {
  return Object.keys(AI_MODELS) as AIModel[];
}

export function getModelDisplayName(model: AIModel): string {
  return AI_MODELS[model]?.name || model;
}
