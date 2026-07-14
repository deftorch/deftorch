'use client';

import { useState, useCallback } from 'react';
import { AnalysisType, ImageAnalysisResult, ImageAttachment } from '@/types';
import { useToast } from '@/lib/store/toast-store';

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const { error, success } = useToast();

  const analyzeImage = useCallback(
    async (image: ImageAttachment, type: AnalysisType) => {
      if (!image) {
        error('No image', 'Please select an image to analyze');
        return;
      }

      try {
        setIsAnalyzing(true);

        // NOTE: Saat ini menggunakan Gemini untuk analisis gambar.
        // Google Cloud Vision API dipertimbangkan untuk fase berikutnya.
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mock result based on analysis type
        const mockResults: Record<AnalysisType, ImageAnalysisResult> = {
          'object-detection': {
            type: 'object-detection',
            detections: [
              { label: 'Person', confidence: 0.98, boundingBox: { x: 100, y: 100, width: 200, height: 300 } },
              { label: 'Car', confidence: 0.95, boundingBox: { x: 300, y: 200, width: 250, height: 150 } },
              { label: 'Tree', confidence: 0.87, boundingBox: { x: 50, y: 50, width: 100, height: 200 } },
            ],
          },
          'label-detection': {
            type: 'label-detection',
            detections: [
              { label: 'Outdoor', confidence: 0.96 },
              { label: 'Sky', confidence: 0.93 },
              { label: 'Nature', confidence: 0.89 },
              { label: 'Landscape', confidence: 0.85 },
              { label: 'Daytime', confidence: 0.82 },
            ],
          },
          'text-recognition': {
            type: 'text-recognition',
            text: 'Sample text extracted from image.\nThis is a mock OCR result.\nImplement Google Cloud Vision API for real text extraction.',
            detections: [],
          },
          'face-detection': {
            type: 'face-detection',
            detections: [
              {
                label: 'Face',
                confidence: 0.97,
                boundingBox: { x: 150, y: 100, width: 120, height: 150 },
              },
            ],
            metadata: {
              emotions: ['Happy', 'Confident'],
              age: '25-35',
            },
          },
          'landmark-recognition': {
            type: 'landmark-recognition',
            detections: [
              { label: 'Eiffel Tower', confidence: 0.99 },
              { label: 'Paris, France', confidence: 0.95 },
            ],
            description: 'Famous landmark in Paris, France. Built in 1889.',
          },
          'image-description': {
            type: 'image-description',
            description:
              'A scenic outdoor landscape featuring a clear blue sky, lush green trees, and a winding path. The image captures a peaceful natural setting with excellent lighting and composition.',
            detections: [],
          },
          'visual-qa': {
            type: 'visual-qa',
            description: 'This is a visual Q&A result. Ask specific questions about the image content.',
            detections: [],
          },
        };

        const mockResult = mockResults[type];
        setResult(mockResult);
        success('Analysis complete', 'Image analyzed successfully');

        return mockResult;
      } catch (err) {
        error('Analysis failed', 'Failed to analyze image. Please try again.');
        console.error(err);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [error, success]
  );

  const analyzeMultipleImages = useCallback(
    async (images: ImageAttachment[], type: AnalysisType) => {
      const results = await Promise.all(images.map((img) => analyzeImage(img, type)));
      return results.filter((r) => r !== null) as ImageAnalysisResult[];
    },
    [analyzeImage]
  );

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isAnalyzing,
    result,
    analyzeImage,
    analyzeMultipleImages,
    clearResult,
  };
}
