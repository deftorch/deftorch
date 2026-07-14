import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithRotation } from '@/lib/gemini-client';
import { analysisRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

import * as z from 'zod';

const ImageAnalysisRequestSchema = z.object({
  imageUrl: z.string().url().max(2000),
  text: z.string().max(2000).optional(),
  sessionId: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'model']),
    content: z.string().max(50000),
  })).max(100).optional(),
  providersConfig: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    analysisRateLimiter.check(15, request);
  } catch {
    return NextResponse.json(
      { error: 'Too many analysis requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const rawBody = await request.json();
    const parseResult = ImageAnalysisRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { imageUrl, text, sessionId, messages = [], providersConfig } = parseResult.data;

    // Build conversation context - limit to last 5 messages to avoid token limit
    let conversationContext = '';
    if (messages.length > 0) {
      const recentMessages = messages.slice(-5); // Only last 5 messages
      conversationContext = 'Previous conversation:\n';
      recentMessages.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        const content = msg.content.length > 200 
          ? msg.content.substring(0, 200) + '...' 
          : msg.content;
        conversationContext += `${role}: ${content}\n`;
      });
      conversationContext += '\n';
    }

    // Combine context with current question - keep it short
    const userQuestion = text || 'What is inside this image? Describe it in detail.';
    const fullPrompt = conversationContext 
      ? `${conversationContext}Current question: ${userQuestion}`
      : userQuestion;

    // Validate URL and fetch safely to prevent SSRF and DNS rebinding
    const { safeFetch } = await import('@/lib/ssrf-guard');
    
    let imageResponse;
    try {
      imageResponse = await safeFetch(imageUrl);
    } catch (err) {
      return NextResponse.json(
        { error: 'Unsafe or invalid image URL provided' },
        { status: 400 }
      );
    }
    
    let base64Image = '';
    let mimeType = 'image/jpeg';
    
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image from URL');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    base64Image = Buffer.from(imageBuffer).toString('base64');
    
    const contentTypeHeader = imageResponse.headers.get('content-type');
    const rawMime = contentTypeHeader?.split(';')[0].trim() || '';
    
    const SUPPORTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    mimeType = SUPPORTED_MIMES.includes(rawMime) ? rawMime : 'image/jpeg';

    if (!SUPPORTED_MIMES.includes(rawMime)) {
      logger.warn('Unrecognized MIME type in image-analysis, defaulting to image/jpeg', { rawMime });
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: fullPrompt,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
    };

    const modelId = 'gemini-2.0-flash-exp';
    const data = await callGeminiWithRotation(modelId, requestBody, providersConfig?.google?.apiKey);

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const resultText = data.candidates[0].content.parts[0].text;

    return NextResponse.json({
      success: true,
      type: 'image-analysis',
      description: resultText,
      timestamp: new Date().toISOString(),
      responseTime: 'N/A',
      provider: 'google',
    });
  } catch (error: any) {
    logger.error('Image analysis API error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
