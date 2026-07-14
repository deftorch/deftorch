export interface UsageMetadata {
  candidatesTokenCount?: number;
  promptTokenCount?: number;
  totalTokenCount?: number;
}

export const parseSSEStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (textChunk: string) => void,
  onDone?: (finalUsageMetadata: UsageMetadata | null) => void,
  onEvent?: (eventData: any) => void
) => {
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';
  let finalUsageMetadata: UsageMetadata | null = null;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Simpan sisa string yang belum selesai

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data:')) {
          const dataStr = trimmedLine.slice(5).trim();
          if (dataStr === '[DONE]' || !dataStr) continue;
          try {
            const eventData = JSON.parse(dataStr);
            
            // Invoke onEvent callback with raw event payload
            if (onEvent) onEvent(eventData);

            if (eventData.type === 'chunk' && typeof eventData.text === 'string') {
              onChunk(eventData.text);
            } else if (eventData.type === 'finish') {
              if (eventData.usage) {
                finalUsageMetadata = {
                  promptTokenCount: eventData.usage.promptTokens,
                  candidatesTokenCount: eventData.usage.completionTokens,
                  totalTokenCount: eventData.usage.totalTokens
                };
              }
            } else if (eventData.candidates) {
              // Legacy fallback for native Gemini stream
              if (eventData.usageMetadata) finalUsageMetadata = eventData.usageMetadata;
              const parts = eventData.candidates?.[0]?.content?.parts || [];
              let combinedText = '';
              for (const part of parts) {
                if (part.text) {
                  combinedText += part.text;
                }
                if (part.executableCode) {
                  combinedText += `\n\`\`\`python\n// Executing code...\n${part.executableCode.code}\n\`\`\`\n`;
                }
                if (part.codeExecutionResult) {
                  combinedText += `\n\`\`\`\n// Execution result:\n${part.codeExecutionResult.output}\n\`\`\`\n`;
                }
              }
              if (combinedText) onChunk(combinedText);
            } else if (eventData.choices) {
              // OpenAI / OpenRouter format
              const textChunk = eventData.choices?.[0]?.delta?.content;
              if (textChunk) onChunk(textChunk);
            }
          } catch (e) {
            // Abaikan JSON yang tidak valid
          }
        }
      }
    }
  }

  // Handle remaining buffer
  if (buffer.trim().startsWith('data:')) {
    try {
      const dataStr = buffer.trim().slice(5).trim();
      if (dataStr && dataStr !== '[DONE]') {
        const eventData = JSON.parse(dataStr);
        if (onEvent) onEvent(eventData);
        if (eventData.type === 'chunk' && typeof eventData.text === 'string') {
          onChunk(eventData.text);
        } else if (eventData.type === 'finish' && eventData.usage) {
          finalUsageMetadata = {
            promptTokenCount: eventData.usage.promptTokens,
            candidatesTokenCount: eventData.usage.completionTokens,
            totalTokenCount: eventData.usage.totalTokens
          };
        } else if (eventData.candidates) {
          if (eventData.usageMetadata) finalUsageMetadata = eventData.usageMetadata;
          const parts = eventData.candidates?.[0]?.content?.parts || [];
          let combinedText = '';
          for (const part of parts) {
            if (part.text) {
              combinedText += part.text;
            }
            if (part.executableCode) {
              combinedText += `\n\`\`\`python\n// Executing code...\n${part.executableCode.code}\n\`\`\`\n`;
            }
            if (part.codeExecutionResult) {
              combinedText += `\n\`\`\`\n// Execution result:\n${part.codeExecutionResult.output}\n\`\`\`\n`;
            }
          }
          if (combinedText) onChunk(combinedText);
        } else if (eventData.choices) {
          const textChunk = eventData.choices?.[0]?.delta?.content;
          if (textChunk) onChunk(textChunk);
        }
      }
    } catch (e) {}
  }

  if (onDone) {
    onDone(finalUsageMetadata);
  }
};
