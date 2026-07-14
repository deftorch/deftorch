const MAX_CODE_LENGTH = 50_000;

export function sanitizeCodeForPrompt(code: string): string {
  if (!code || typeof code !== 'string') return '';
  
  const truncated = code.length > MAX_CODE_LENGTH 
    ? code.slice(0, MAX_CODE_LENGTH) + '\n// [truncated]'
    : code;

  // Escape triple backticks that can close the code block in the system prompt
  return truncated.replace(/```/g, '` ` `');
}
