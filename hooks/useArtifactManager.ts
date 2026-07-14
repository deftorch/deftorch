import { useChatStore } from '@/lib/store/chat-store';
import { RendererType } from '@/types';
import { useCallback } from 'react';

export function useArtifactManager() {
  const chatStore = useChatStore();

  const addArtifact = useCallback((
    chatId: string,
    chatTitle: string,
    code: string,
    renderer: RendererType = 'p5',
  ) => {
    chatStore.addArtifact({
      chatId,
      chatTitle,
      code,
      renderer,
    });
  }, [chatStore]);

  const deleteArtifact = useCallback((artifactId: string) => {
    chatStore.deleteArtifact(artifactId);
  }, [chatStore]);

  return { addArtifact, deleteArtifact };
}
