import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG, IMAGE_ANALYSIS_MODELS } from '@/config/constants';
import { callGeminiWithRotation } from '@/lib/gemini-client';
import { analysisRateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

import * as z from 'zod';

const GeminiAnalysisRequestSchema = z.object({
  imageUrl: z.string().url().max(2000),
  prompt: z.string().max(50000).optional(),
  analysisType: z.string().optional(),
  modelId: z.string().optional(),
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
    const parseResult = GeminiAnalysisRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { imageUrl, prompt, analysisType, modelId = 'gemini-native', providersConfig } = parseResult.data;

    // Find selected model
    const selectedModel = IMAGE_ANALYSIS_MODELS.find(m => m.id === modelId);
    if (!selectedModel) {
      return NextResponse.json(
        { error: 'Invalid model ID' },
        { status: 400 }
      );
    }



    if (selectedModel.apiType === 'gemini-native' && !API_CONFIG.GEMINI_API_KEY && !providersConfig?.google?.apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    if (selectedModel.apiType === 'openrouter' && !API_CONFIG.OPENROUTER_API_KEY && !providersConfig?.openrouter?.apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // Validate URL and fetch safely to prevent SSRF and DNS rebinding
    const { safeFetch } = await import('@/lib/ssrf-guard');
    
    // Fetch the image and convert to base64 (only for Gemini Native)
    let base64Image = '';
    let mimeType = 'image/jpeg';
    
    if (selectedModel.apiType === 'gemini-native') {
      let imageResponse;
      try {
        imageResponse = await safeFetch(imageUrl);
      } catch (err) {
        return NextResponse.json(
          { error: 'Unsafe or invalid image URL provided' },
          { status: 400 }
        );
      }

      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image');
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      base64Image = Buffer.from(imageBuffer).toString('base64');
      
      // Determine MIME type from response header, with whitelist
      const contentTypeHeader = imageResponse.headers.get('content-type');
      const rawMime = contentTypeHeader?.split(';')[0].trim() || '';
      
      const SUPPORTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      mimeType = SUPPORTED_MIMES.includes(rawMime) ? rawMime : 'image/jpeg';

      if (!SUPPORTED_MIMES.includes(rawMime)) {
        logger.warn('Unrecognized MIME type in gemini-analysis, defaulting to image/jpeg', { rawMime });
      }
    }

    // Build prompt based on analysis type
    const prompts: Record<string, string> = {
      'object-detection': `Lakukan deteksi objek komprehensif pada gambar ini. Berikan respons JSON terperinci yang berisi:

1. Semua objek yang terdeteksi dengan:
   - Nama/label objek dalam bahasa Indonesia
   - Skor kepercayaan (0-1)
   - Koordinat kotak pembatas (vertices ternormalisasi)
   - Kategori/kelas objek

2. Format respons sebagai:
{
  "detected_objects": [
    {
      "name": "string (Indonesian)",
      "confidence": float,
      "bounding_box": {
        "vertices": [{"x": float, "y": float}]
      },
      "category": "string"
    }
  ],
  "total_objects": integer,
  "image_properties": {
    "dominant_colors": ["color1", "color2"],
    "brightness": "string"
  }
}

Urutkan objek berdasarkan skor kepercayaan (tertinggi terlebih dahulu).`,

      'label-detection': `Lakukan deteksi label komprehensif pada gambar ini. Berikan respons JSON terperinci:

{
  "labels": [
    {
      "name": "string (Indonesian)",
      "confidence": float,
      "category": "string",
      "description": "string"
    }
  ],
  "scene_attributes": {
    "location_type": "string",
    "activity": "string",
    "time_of_day": "string",
    "weather": "string"
  },
  "total_labels": integer
}

Sertakan label untuk objek, aktivitas, suasana, dan konteks. Urutkan berdasarkan kepercayaan tertinggi.`,

      'text-recognition': `Ekstrak dan transkripsi semua teks yang terlihat dalam gambar ini (OCR). Berikan respons JSON:

{
  "text_annotations": [
    {
      "text": "string",
      "confidence": float,
      "language": "string",
      "bounding_box": {
        "vertices": [{"x": float, "y": float}]
      }
    }
  ],
  "full_text": "string (complete text in reading order)",
  "languages_detected": ["language1", "language2"],
  "total_words": integer,
  "total_lines": integer
}

Pertahankan urutan pembacaan yang benar (kiri ke kanan, atas ke bawah).`,

      'face-detection': `Deteksi dan analisis semua wajah dalam gambar ini. Berikan respons JSON terperinci:

{
  "faces": [
    {
      "face_id": integer,
      "confidence": float,
      "bounding_box": {
        "vertices": [{"x": float, "y": float}]
      },
      "attributes": {
        "age_range": "string",
        "gender": "string",
        "emotion": "string",
        "facial_hair": "string",
        "glasses": "string",
        "smile": boolean
      },
      "pose": {
        "roll": float,
        "yaw": float,
        "pitch": float
      }
    }
  ],
  "total_faces": integer,
  "scene_context": "string"
}

Analisis setiap wajah secara detail. Gunakan bahasa Indonesia untuk deskripsi.`,

      'landmark-recognition': `Identifikasi landmark, monumen, atau lokasi terkenal dalam gambar ini. Berikan respons JSON:

{
  "landmarks": [
    {
      "name": "string (Indonesian & English)",
      "confidence": float,
      "location": {
        "country": "string",
        "city": "string",
        "coordinates": "string (if known)"
      },
      "category": "string",
      "description": "string (historical/cultural info)",
      "fun_facts": ["fact1", "fact2"]
    }
  ],
  "architectural_style": "string",
  "estimated_age": "string",
  "cultural_significance": "string"
}

Jika tidak ada landmark terkenal, berikan informasi tentang jenis bangunan/lokasi yang terlihat.`,

      'image-description': `Berikan deskripsi komprehensif dan terperinci tentang gambar ini. Format respons JSON:

{
  "summary": "string (1-2 sentences overview)",
  "detailed_description": "string (comprehensive description)",
  "composition": {
    "foreground": "string",
    "background": "string",
    "focal_point": "string"
  },
  "visual_elements": {
    "colors": ["color1", "color2"],
    "lighting": "string",
    "mood": "string",
    "style": "string"
  },
  "objects_present": ["object1", "object2"],
  "activities": ["activity1", "activity2"],
  "scene_type": "string",
  "quality": {
    "resolution": "string",
    "clarity": "string",
    "composition_quality": "string"
  }
}

Berikan analisis mendalam tentang semua aspek visual gambar.`,

      'visual-qa': prompt ? `Jawab pertanyaan berikut tentang gambar ini secara detail dan akurat:

PERTANYAAN: "${prompt}"

Berikan respons dalam format JSON:
{
  "question": "${prompt}",
  "answer": "string (detailed answer)",
  "confidence": float,
  "supporting_details": ["detail1", "detail2"],
  "relevant_objects": ["object1", "object2"],
  "additional_context": "string"
}

Analisis gambar dengan cermat dan berikan jawaban yang komprehensif.` : 
`Analisis gambar ini dan jawab pertanyaan umum. Format JSON:

{
  "general_analysis": {
    "what": "string (what is shown)",
    "where": "string (location/setting)",
    "when": "string (time/era)",
    "who": "string (people/subjects)",
    "why": "string (purpose/context)"
  },
  "key_elements": ["element1", "element2"],
  "interesting_details": ["detail1", "detail2"]
}`,
    };

    const analysisPrompt = (analysisType ? prompts[analysisType] : undefined) || prompts['image-description'];

    let result: string;

    // Route to appropriate API based on model type
    if (selectedModel.apiType === 'gemini-native') {
      // Use Google Gemini Native API

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt || analysisPrompt,
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

      const data = await callGeminiWithRotation(selectedModel.modelId, requestBody, providersConfig?.google?.apiKey);

      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        logger.error('Invalid Gemini response structure', { data: JSON.stringify(data).slice(0, 500) });
        throw new Error('Invalid response from Gemini API');
      }

      result = data.candidates[0].content.parts[0].text;

    } else if (selectedModel.apiType === 'openrouter') {
      // Use OpenRouter API (OpenAI-compatible)

      // OpenRouter requires public image URL, not base64
      const openRouterBody = {
        model: selectedModel.modelId,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || analysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl, // Use direct image URL from ThumbSnap
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.4,
      };



      const openRouterResponse = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${providersConfig?.openrouter?.apiKey || API_CONFIG.OPENROUTER_API_KEY}`,
            'HTTP-Referer': API_CONFIG.OPENROUTER_SITE_URL || 'http://localhost:3000',
            'X-Title': API_CONFIG.OPENROUTER_SITE_NAME || 'Genesis',
          },
          body: JSON.stringify(openRouterBody),
        }
      );

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        logger.error('OpenRouter API error', {
          status: openRouterResponse.status,
          body: errorText.slice(0, 500),
        });
        
        let errorMessage = `OpenRouter API error (${openRouterResponse.status})`;
        let userFriendlyMessage = '';
        
        try {
          const errorData = JSON.parse(errorText);
          const providerMessage = errorData.error?.metadata?.raw;
          errorMessage = errorData.error?.message || errorMessage;
          
          // Handle specific error codes with user-friendly messages
          if (openRouterResponse.status === 401) {
            userFriendlyMessage = '🔑 API key tidak valid. Silakan verifikasi API key di https://openrouter.ai/keys';
          } else if (openRouterResponse.status === 429) {
            // Rate limit error
            if (providerMessage && providerMessage.includes('rate-limited')) {
              userFriendlyMessage = `⏱️ Model "${selectedModel.name}" sedang terlalu banyak permintaan (rate limit).\n\n💡 Solusi:\n• Gunakan model "Gemini 2.0 Flash (Native)" sebagai gantinya\n• Atau tunggu beberapa saat dan coba lagi\n• Atau tambahkan API key Google Anda sendiri di OpenRouter`;
            } else {
              userFriendlyMessage = '⏱️ Terlalu banyak permintaan. Silakan tunggu beberapa saat atau gunakan model lain.';
            }
          } else if (openRouterResponse.status === 404) {
            userFriendlyMessage = '❌ Model tidak ditemukan atau tidak support image input. Silakan pilih model lain.';
          } else if (openRouterResponse.status >= 500) {
            userFriendlyMessage = '🔧 Server error dari provider. Silakan coba model lain atau tunggu beberapa saat.';
          }
          
          // Use user-friendly message if available
          if (userFriendlyMessage) {
            errorMessage = userFriendlyMessage;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await openRouterResponse.json();


      if (!data.choices || !data.choices[0]?.message?.content) {
        logger.error('Invalid OpenRouter response structure', { data: JSON.stringify(data).slice(0, 500) });
        throw new Error('Invalid response from OpenRouter API');
      }

      result = data.choices[0].message.content;
    } else {
      throw new Error('Unknown API type');
    }

    return NextResponse.json({
      success: true,
      analysisType,
      result,
      model: selectedModel.name,
      modelId: selectedModel.modelId,
      provider: selectedModel.provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Image analysis error', { error: error.message, stack: error.stack });
    
    const errorMessage = error.message || '';
    const isQuota = errorMessage.toLowerCase().includes('quota') ||
                    errorMessage.toLowerCase().includes('exhausted') ||
                    errorMessage.toLowerCase().includes('rate limit') ||
                    errorMessage.toLowerCase().includes('too many requests') ||
                    errorMessage.toLowerCase().includes('limit reached') ||
                    errorMessage.toLowerCase().includes('429');

    return NextResponse.json(
      {
        success: false,
        error: isQuota 
          ? 'Your daily usage limit has been reached. Please come back tomorrow.' 
          : (error.message || 'Failed to analyze image'),
        details: error.stack,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
