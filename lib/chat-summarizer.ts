import { Message } from '@/types';

/**
 * Summarize chat messages untuk mengurangi token yang dikirim ke API
 * Menggunakan strategi slice-by-slice: setiap N messages dirangkum
 */

const MESSAGES_PER_SLICE = 10; // Rangkum setiap 10 messages
const MAX_SUMMARY_LENGTH = 500; // Max panjang summary per slice

/**
 * Generate summary dari messages
 */
export function generateMessagesSummary(messages: Message[]): string {
  if (messages.length === 0) return '';

  const summaryParts: string[] = [];
  let currentTopic = '';
  let userQuestions: string[] = [];
  let aiResponses: string[] = [];

  messages.forEach((msg, index) => {
    if (msg.role === 'user') {
      // Ambil topik utama dari user question
      const shortContent = msg.content.substring(0, 100);
      userQuestions.push(shortContent);
    } else if (msg.role === 'assistant') {
      // Ambil poin penting dari AI response
      const shortContent = msg.content.substring(0, 100);
      aiResponses.push(shortContent);
    }

    // Setiap MESSAGES_PER_SLICE, buat summary
    if ((index + 1) % MESSAGES_PER_SLICE === 0 || index === messages.length - 1) {
      if (userQuestions.length > 0) {
        summaryParts.push(`Topics discussed: ${userQuestions.join('; ')}`);
      }
      userQuestions = [];
      aiResponses = [];
    }
  });

  const fullSummary = summaryParts.join('\n');
  
  // Truncate jika terlalu panjang
  if (fullSummary.length > MAX_SUMMARY_LENGTH) {
    return fullSummary.substring(0, MAX_SUMMARY_LENGTH) + '...';
  }

  return fullSummary;
}

/**
 * Build context untuk API request
 * Menggunakan summary untuk old messages + full messages untuk recent messages
 */
export function buildContextForAPI(
  messages: Message[],
  summary?: string,
  lastSummarizedIndex?: number
): { role: string; content: string; attachments?: { type: string; dataUrl: string }[] }[] {
  const RECENT_MESSAGES_COUNT = 5; // Keep last 5 messages full
  
  const context: { role: string; content: string; attachments?: { type: string; dataUrl: string }[] }[] = [];

  // Add summary jika ada (untuk old messages)
  if (summary && lastSummarizedIndex !== undefined) {
    context.push({
      role: 'system',
      content: `Previous conversation summary:\n${summary}\n\nContinue the conversation naturally based on the context above.`
    });
  }

  // Get recent messages (after summary)
  const startIndex = lastSummarizedIndex !== undefined 
    ? Math.max(lastSummarizedIndex + 1, messages.length - RECENT_MESSAGES_COUNT)
    : Math.max(0, messages.length - RECENT_MESSAGES_COUNT);

  const recentMessages = messages.slice(startIndex);

  // Add recent messages dengan full content
  recentMessages.forEach(msg => {
    // Truncate very long messages
    const content = msg.content.length > 1000 
      ? msg.content.substring(0, 1000) + '...'
      : msg.content;
    
    context.push({
      role: msg.role,
      content: content
    });
  });

  return context;
}

/**
 * Check apakah perlu update summary
 */
export function shouldUpdateSummary(
  messagesCount: number,
  lastSummarizedIndex?: number
): boolean {
  if (lastSummarizedIndex === undefined) {
    // Belum pernah di-summarize, check jika sudah > MESSAGES_PER_SLICE
    return messagesCount >= MESSAGES_PER_SLICE;
  }

  // Update summary setiap bertambah MESSAGES_PER_SLICE messages baru
  const newMessagesCount = messagesCount - lastSummarizedIndex - 1;
  return newMessagesCount >= MESSAGES_PER_SLICE;
}

/**
 * Format context untuk display (untuk debugging)
 */
export function formatContextPreview(
  messages: Message[],
  summary?: string
): string {
  let preview = '';
  
  if (summary) {
    preview += `📋 Summary: ${summary}\n\n`;
  }
  
  preview += `💬 Recent messages (${messages.length}):\n`;
  messages.slice(-3).forEach(msg => {
    const role = msg.role === 'user' ? '👤' : '🤖';
    const content = msg.content.substring(0, 50) + '...';
    preview += `${role} ${content}\n`;
  });
  
  return preview;
}
