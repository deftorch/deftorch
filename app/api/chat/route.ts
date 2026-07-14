import { NextRequest, NextResponse } from 'next/server';
import { streamGeminiWithRotation } from '@/lib/gemini-client';
import { resolveNonGeminiModel } from '@/lib/ai-providers';
import { chatRateLimiter } from '@/lib/rate-limiter';
import { sanitizeCodeForPrompt } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

import * as z from 'zod';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(50000),
  })).min(1).max(100),
  model: z.string().optional(),
  modelId: z.string().optional(),
  config: z.any().optional(),
  providersConfig: z.any().optional(),
  images: z.array(z.object({
    base64: z.string().optional(),
    mimeType: z.string().optional(),
    url: z.string().url().optional(),
    // Fase D: Gemini File API URI for large media uploaded via
    // /api/upload-media/* (see lib/gemini-file-upload.ts). Only
    // meaningful for Gemini models — files.googleapis.com URIs aren't
    // fetchable by other providers.
    fileUri: z.string().optional(),
  })).max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    chatRateLimiter.check(20, req);
  } catch {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const rawBody = await req.json();
    const parseResult = ChatRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { messages, model, modelId, config, providersConfig, images } = parseResult.data;

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    const lastUserPrompt = lastMessage?.content || '';

    if (!lastUserPrompt || lastUserPrompt.trim() === '') {
      return NextResponse.json(
        { error: 'Empty message content' },
        { status: 400 }
      );
    }

    // Extract custom system instruction from messages or config if provided
    const systemMessageIndex = messages.findIndex((m: any) => m.role === 'system');
    let customSystemPrompt = '';
    if (systemMessageIndex !== -1) {
      customSystemPrompt = messages[systemMessageIndex].content;
      // Remove it from messages so it doesn't get mapped as a user message
      messages.splice(systemMessageIndex, 1);
    }
    
    // Also check if config.systemInstruction is passed (for default settings)
    if (config?.systemInstruction) {
      customSystemPrompt = config.systemInstruction;
    }

    // Build system instruction: Completely pure. 
    // If a custom system prompt is provided (via Agent or Settings), it becomes the absolute system prompt.
    // If none is provided, it remains completely empty.
    let systemPrompt = customSystemPrompt || '';

    let targetModel = modelId || model || 'gemini-3.5-flash';

    // Graph-based Workflow Execution
    if (config?.workflow) {
      const workflow = config.workflow;
      const nodes = workflow.nodes || [];
      
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (type: string, data: any) => {
            const payload = JSON.stringify({ type, ...data });
            controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          };
          
          try {
            sendEvent('debug', { message: `🚀 [Workflow] Initializing pipeline: ${workflow.name}` });
            await new Promise(r => setTimeout(r, 600));
            
            let currentNode = nodes.find((n: any) => n.type === 'trigger');
            let accumulatedContext = lastUserPrompt;
            
            while (currentNode) {
              sendEvent('debug', { message: `⏳ [Workflow] Executing node: ${currentNode.title} (${currentNode.type})` });
              
              if (currentNode.type === 'tool') {
                sendEvent('debug', { message: `🔍 [Workflow] Tool executing: Fetching real data via Gemini Grounding API...` });
                
                try {
                  const { callGeminiWithRotation } = await import('@/lib/gemini-client');
                  const toolResponse = await callGeminiWithRotation('gemini-2.5-flash', {
                    contents: [{ role: 'user', parts: [{ text: `Perform a web search to gather relevant context for this prompt: ${accumulatedContext}` }] }],
                    tools: [{ googleSearch: {} }],
                    generationConfig: { temperature: 0.3 }
                  }, providersConfig?.google?.apiKey);
                  
                  const toolText = toolResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No additional information found.';
                  accumulatedContext += `\n[Tool Output Context (${currentNode.title}):\n${toolText}]\n`;
                  sendEvent('debug', { message: `✅ [Workflow] Tool completed successfully.` });
                } catch (toolErr: any) {
                  sendEvent('debug', { message: `⚠️ [Workflow] Tool execution failed: ${toolErr.message}` });
                  accumulatedContext += `\n[Tool Output Context (${currentNode.title}): Failed to fetch data]\n`;
                }
              } else if (currentNode.type === 'agent') {
                const resolvedAgent = currentNode.config?.resolvedAgent;

                if (!resolvedAgent) {
                  // Agent could not be resolved client-side (e.g. deleted after the
                  // workflow was created). Fail loudly instead of silently faking success.
                  sendEvent('debug', { message: `⚠️ [Workflow] Agent node "${currentNode.title}" has no resolvable agent — skipping.` });
                } else {
                  sendEvent('debug', { message: `🤖 [Workflow] Agent "${resolvedAgent.name}" analyzing...` });

                  try {
                    const { callGeminiWithRotation } = await import('@/lib/gemini-client');
                    const tools = [];
                    if (resolvedAgent.useSearchGrounding) tools.push({ googleSearch: {} });
                    if (resolvedAgent.useCodeExecution) tools.push({ codeExecution: {} });

                    const agentResponse = await callGeminiWithRotation('gemini-3-flash-preview', {
                      contents: [{ role: 'user', parts: [{ text: accumulatedContext }] }],
                      systemInstruction: { parts: [{ text: resolvedAgent.systemInstruction }] },
                      ...(tools.length > 0 ? { tools } : {}),
                      generationConfig: { temperature: resolvedAgent.temperature ?? 0.7 },
                    }, providersConfig?.google?.apiKey);

                    const agentText = agentResponse.candidates?.[0]?.content?.parts
                      ?.map((p: any) => p.text).filter(Boolean).join('\n') || 'No output produced.';
                    accumulatedContext += `\n[Agent Output (${resolvedAgent.name}):\n${agentText}]\n`;
                    sendEvent('debug', { message: `✅ [Workflow] Agent "${resolvedAgent.name}" analysis complete.` });
                  } catch (agentErr: any) {
                    sendEvent('debug', { message: `⚠️ [Workflow] Agent execution failed: ${agentErr.message}` });
                    accumulatedContext += `\n[Agent Output (${resolvedAgent.name}): Failed to produce a response]\n`;
                  }
                }
              } else if (currentNode.type === 'condition') {
                await new Promise(r => setTimeout(r, 500));
                sendEvent('debug', { message: `✅ [Workflow] Condition evaluated: Proceeding to next step.` });
              }
              
              // Move to next node (simple linear traversal for demo)
              if (currentNode.nextNodes && currentNode.nextNodes.length > 0) {
                currentNode = nodes.find((n: any) => n.id === currentNode.nextNodes[0]);
              } else {
                break;
              }
            }
            
            sendEvent('debug', { message: `✨ [Workflow] Graph traversal complete. Synthesizing final response...` });
            
            const finalPrompt = `[WORKFLOW CONTEXT]\nThe user initiated a workflow. Here is their request: ${lastUserPrompt}\nHere is the data gathered during the workflow execution:\n${accumulatedContext}\n\nPlease generate the final comprehensive response based on this workflow context.`;
            
            const requestBody = {
              contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: { temperature: 0.5, maxOutputTokens: 8192 }
            };
            
            const geminiResponse = await streamGeminiWithRotation('gemini-3-flash-preview', requestBody, providersConfig?.google?.apiKey);
            
            if (geminiResponse.body) {
              const reader = geminiResponse.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            }
            controller.close();
            
          } catch (e: any) {
            sendEvent('error', { error: `Workflow execution failed: ${e.message}` });
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Smart Routing Logic for "Smart Router (Basic)"
    if (targetModel === 'router-basic' || config?.compositeModel?.id === 'router-basic') {
      const isCodeTask = /code|python|react|javascript|html|css|bug|error|p5|d3|svg/i.test(lastUserPrompt);
      if (isCodeTask) {
        targetModel = 'llama-3.3-70b-specdec';
        logger.info('Smart Router: Routed to LLaMA (Code Task)');
      } else {
        targetModel = 'gpt-4o';
        logger.info('Smart Router: Routed to GPT-4o (General Task)');
      }
    } else if (targetModel === 'sequential-reviewer' || config?.compositeModel?.id === 'sequential-reviewer') {
      // NOTE: Not yet migrated to the AI SDK / lib/ai-providers.ts helper.
      // This still talks to OpenRouter directly via raw fetch(), same as
      // before the Fase B migration. It's a deliberate scope decision, not
      // an oversight — the drafter/reviewer pipeline is a fixed two-model
      // orchestration, not general chat routing, so it's lower priority
      // than the main single-model path migrated below. Follow-up work.
      // True Sequential Pipeline Execution
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (type: string, data: any) => {
            const payload = JSON.stringify({ type, ...data });
            controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          };
          
          try {
            sendEvent('debug', { message: `🚀 [Sequential Pipeline] Starting Drafter Agent (LLaMA 3.3)...` });
            
            const openRouterKey = providersConfig?.openrouter?.apiKey || process.env.OPENROUTER_API_KEY;
            if (!openRouterKey) {
              throw new Error('OpenRouter API Key is required for Sequential Reviewer');
            }
            
            // 1. Call Drafter (LLaMA-3.3) non-streaming
            const drafterMessages = messages.map((msg: any) => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            }));
            
            drafterMessages.unshift({
              role: 'system', 
              content: 'You are the Drafter. Write a highly detailed first draft based on the user request. Focus on content completeness.'
            });

            const drafterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deftorch.com',
                'X-Title': 'Deftorch'
              },
              body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct',
                messages: drafterMessages,
                stream: false
              })
            });
            
            if (!drafterRes.ok) {
              const err = await drafterRes.text();
              throw new Error(`Drafter failed: ${err}`);
            }
            
            const drafterData = await drafterRes.json();
            const draftText = drafterData.choices?.[0]?.message?.content || '';
            
            sendEvent('debug', { message: `✅ [Sequential Pipeline] Drafter finished. Reviewer (Claude 3.5 Sonnet) is now polishing and finalizing...` });
            
            // 2. Call Reviewer (Claude-3.5-Sonnet) streaming
            const reviewerPrompt = `[DRAFTER OUTPUT]\n${draftText}\n\n[ORIGINAL USER REQUEST]\n${lastUserPrompt}\n\nYou are the final Reviewer. Take the Drafter's output above, refine it, fix any issues, and produce the final, polished response for the user. Do not just output the draft, improve it significantly and ensure it strictly follows the system rules.`;
            
            const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deftorch.com',
                'X-Title': 'Deftorch'
              },
              body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: reviewerPrompt }
                ],
                stream: true,
                temperature: config?.temperature ?? 0.7,
              })
            });

            if (!orResponse.ok) {
              const err = await orResponse.text();
              throw new Error(`Reviewer failed: ${err}`);
            }

            if (orResponse.body) {
              const reader = orResponse.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            }
            
            controller.close();
          } catch (e: any) {
            sendEvent('error', { error: e.message });
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const isGeminiModel = targetModel.startsWith('gemini-');

    if (isGeminiModel) {
      // Map roles to Gemini roles ('user' and 'model')
      const contents = messages.map((msg: any, idx: number) => {
        const parts: any[] = [
          {
            text: msg.content || '',
          },
        ];

        // Attach images to the LAST user message
        if (images && images.length > 0 && idx === messages.length - 1 && msg.role === 'user') {
          for (const img of images) {
            if (img.fileUri && img.mimeType) {
              // Fase D: file already uploaded to Gemini's File API
              // (large video/audio/PDF via /api/upload-media/complete) —
              // reference it directly instead of resending the bytes.
              parts.push({
                fileData: {
                  mimeType: img.mimeType,
                  fileUri: img.fileUri,
                },
              });
            } else if (img.base64 && img.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: img.mimeType,
                  data: img.base64,
                },
              });
            } else if (img.url && !img.url.startsWith('data:')) {
              // NOTE: this is a best-effort fallback, not a real
              // attachment — the Gemini REST API has no way to fetch an
              // arbitrary external URL itself, so this just tells the
              // model the URL exists as text. Anything that needs Gemini
              // to actually SEE the file must go through fileUri (above)
              // or inlineData, not this branch.
              try {
                parts.push({
                  text: `[Image URL: ${img.url}]`,
                });
              } catch {}
            }
          }
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      const tools: any[] = [];
      if (config?.useSearchGrounding) {
        tools.push({ googleSearch: {} });
      }
      if (config?.useCodeExecution) {
        tools.push({ codeExecution: {} });
      }

      const requestBody: any = {
        contents,
        systemInstruction: {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
        generationConfig: {
          temperature: config?.temperature ?? 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 65536,
        },
      };

      if (tools.length > 0) {
        requestBody.tools = tools;
      } else if (config?.useStructuredOutputs) {
        // Gemini does not support combining function-calling tools with JSON
        // response mode in the same request, so this only applies when no
        // search grounding / code execution tool is active. This is the
        // "Force Structured JSON" toggle from the Agents form — previously
        // a no-op, now actually wired through.
        requestBody.generationConfig.responseMimeType = 'application/json';
      }

      // Map model names to Gemini API model IDs
      const modelIdMap: Record<string, string> = {
        'gemini-3.5-flash': 'gemini-3-flash-preview',
        'gemini-3.1-pro-preview': 'gemini-1.5-pro',
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      };

      const geminiModelId = modelIdMap[targetModel] || 'gemini-3-flash-preview';

      // Call Gemini with Key Rotation to get a stream
      const response = await streamGeminiWithRotation(geminiModelId, requestBody, providersConfig?.google?.apiKey);

      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // ============================================================
      // Non-Gemini providers — migrated to the Vercel AI SDK.
      //
      // This used to be a single hand-rolled fetch() straight to OpenRouter
      // for every non-Gemini model. It's now routed through
      // lib/ai-providers.ts, which calls OpenAI/Anthropic/Groq/DeepSeek
      // DIRECTLY with their own keys, and only falls back to OpenRouter for
      // model ids Deftorch doesn't have an explicit mapping for. No AI
      // Gateway involved — plain provider API keys, same BYOK pattern as
      // the Gemini branch above.
      // ============================================================
      const { streamText } = await import('ai');

      let resolved;
      try {
        resolved = resolveNonGeminiModel(targetModel, providersConfig);
      } catch (resolveErr: any) {
        return NextResponse.json({ error: resolveErr.message }, { status: 400 });
      }

      const sdkMessages: any[] = messages.map((msg, idx) => {
        if (images && images.length > 0 && idx === messages.length - 1 && msg.role === 'user') {
          const content: any[] = [{ type: 'text', text: msg.content }];
          images.forEach((img) => {
            if (img.base64 && img.mimeType) {
              content.push({ type: 'image', image: `data:${img.mimeType};base64,${img.base64}` });
            } else if (img.url && !img.url.startsWith('data:')) {
              content.push({ type: 'image', image: img.url });
            }
            // img.fileUri (Gemini File API URI, files.googleapis.com) is
            // intentionally not handled here — it's only fetchable with a
            // Gemini API key, so it can't be forwarded to OpenAI/
            // Anthropic/Groq/DeepSeek. A fileUri-only attachment sent
            // alongside a non-Gemini model selection is silently dropped
            // rather than erroring; the chat still sends, just without
            // that attachment. Surfacing this to the user (rather than
            // silent drop) belongs with the Fase A-style "model +
            // capability" validation already done for Search
            // Grounding/Code Execution in AgentsView.tsx, not repeated
            // ad hoc here.
          });
          return { role: 'user', content };
        }
        return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
      });

      // "Force Structured JSON" for non-Gemini providers. Only OpenAI/Groq/
      // DeepSeek/OpenRouter expose an actual JSON-mode response format via
      // the AI SDK today; Claude has no equivalent provider option, so it
      // falls back to a plain instruction appended to the system prompt.
      const providerOptions: Record<string, any> = {};
      let effectiveSystemPrompt = systemPrompt;
      if (config?.useStructuredOutputs) {
        if (resolved.supportsJsonMode) {
          providerOptions[resolved.providerId] = { responseFormat: { type: 'json_object' } };
        } else {
          effectiveSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with a single valid JSON object only. Do not include any prose, explanation, or markdown formatting outside the JSON.`;
        }
      }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (type: string, data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
          };

          try {
            const result = streamText({
              model: resolved.model,
              system: effectiveSystemPrompt || undefined,
              messages: sdkMessages,
              temperature: config?.temperature ?? 0.7,
              ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
            });

            for await (const textPart of result.textStream) {
              sendEvent('chunk', { text: textPart });
            }

            const usage = await result.usage;
            sendEvent('finish', {
              usage: {
                promptTokens: usage?.inputTokens,
                completionTokens: usage?.outputTokens,
                totalTokens: usage?.totalTokens,
              },
            });
          } catch (streamErr: any) {
            sendEvent('error', { error: streamErr.message || 'Provider request failed' });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

  } catch (error: any) {
    logger.error('Chat API error', { error: error.message, stack: error.stack });
    const isQuota = error.status === 429 || error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('429');
    
    return NextResponse.json(
      {
        error: isQuota
          ? 'Your daily usage limit has been reached. Please come back tomorrow.'
          : (error.message || 'Failed to process chat request'),
        details: error.details || error.message,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
