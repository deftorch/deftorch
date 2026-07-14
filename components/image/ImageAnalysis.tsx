'use client';

import React from 'react';
import { Check, Upload, X, Loader2, Sparkles } from 'lucide-react';
import { AnalysisType } from '@/types';
import { ANALYSIS_TYPES, IMAGE_ANALYSIS_MODELS } from '@/config/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface ImageAnalysisProps {
  onClose?: () => void;
}

export const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ onClose }) => {
  const [selectedType, setSelectedType] = React.useState<AnalysisType>('image-description');
  const [selectedModel, setSelectedModel] = React.useState('gemini-native');
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string>('');
  const [customPrompt, setCustomPrompt] = React.useState('');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setResult(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      // First upload to ThumbSnap
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Failed to upload image');
      }

      // Then analyze with Gemini
      const analysisResponse = await fetch('/api/gemini-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadData.url,
          prompt: customPrompt || undefined,
          analysisType: selectedType,
          modelId: selectedModel,
        }),
      });

      const analysisData = await analysisResponse.json();

      if (!analysisResponse.ok) {
        throw new Error(analysisData.error || analysisData.details || 'Failed to analyze image');
      }

      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Analysis was not successful');
      }

      setResult(analysisData);
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('=== FRONTEND ANALYSIS ERROR ===');
        console.error('Error:', error);
        console.error('Error Message:', error.message);
        console.error('================================');
      }
      
      // Create user-friendly error display
      const errorMessage = error.message || 'Failed to analyze image';
      const isRateLimitError = errorMessage.includes('rate limit') || errorMessage.includes('⏱️');
      const isModelError = errorMessage.includes('Model') || errorMessage.includes('❌');
      
      setResult({
        success: false,
        error: errorMessage,
        isRateLimitError,
        isModelError,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Upload Image</h3>
        
        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP up to 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-auto max-h-96 object-contain bg-muted"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Analysis Type Selection */}
      {imagePreview && (
        <>
          {/* Model Selector */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Select AI Model
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {IMAGE_ANALYSIS_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  disabled={isAnalyzing}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50',
                    selectedModel === model.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border',
                    isAnalyzing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{model.name}</span>
                      {model.free && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full font-medium">
                          FREE
                        </span>
                      )}
                    </div>
                    {selectedModel === model.id && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{model.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Provider: {model.provider} • {model.apiType}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Select Analysis Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ANALYSIS_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  disabled={isAnalyzing}
                  className={cn(
                    'p-4 border-2 rounded-lg text-left transition-all hover:border-primary/50',
                    selectedType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border',
                    isAnalyzing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{type.icon}</span>
                    {selectedType === type.value && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-sm">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt for Visual Q&A */}
          {selectedType === 'visual-qa' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Ask a question about the image
              </label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., What colors are present? How many people are there?"
                disabled={isAnalyzing}
                className="min-h-[100px]"
              />
            </div>
          )}

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !imageFile}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing with {IMAGE_ANALYSIS_MODELS.find(m => m.id === selectedModel)?.name}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze Image with {IMAGE_ANALYSIS_MODELS.find(m => m.id === selectedModel)?.provider}
              </>
            )}
          </Button>
        </>
      )}

      {/* Results Display */}
      {result && (
        <div>
          {result.success ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Analysis Results</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {result.provider}
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                    {selectedType}
                  </span>
                </div>
              </div>
              
              {/* Try to parse JSON response */}
              {(() => {
                try {
                  // Extract JSON from markdown code blocks if present
                  let jsonText = result.result;
                  const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
                  if (jsonMatch) {
                    jsonText = jsonMatch[1];
                  }
                  
                  const parsed = JSON.parse(jsonText);
                  
                  return (
                    <div className="space-y-4">
                      {/* Pretty JSON Display */}
                      <div className="bg-muted/50 rounded-lg p-4 max-h-[500px] overflow-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      </div>

                      {/* Quick Stats */}
                      {parsed.total_objects && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="text-2xl font-bold text-primary">
                              {parsed.total_objects}
                            </div>
                            <div className="text-xs text-muted-foreground">Objects Detected</div>
                          </div>
                          {parsed.detected_objects?.[0]?.confidence && (
                            <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                              <div className="text-2xl font-bold text-green-500">
                                {(parsed.detected_objects[0].confidence * 100).toFixed(1)}%
                              </div>
                              <div className="text-xs text-muted-foreground">Top Confidence</div>
                            </div>
                          )}
                        </div>
                      )}

                      {parsed.total_faces && (
                        <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                          <div className="text-2xl font-bold text-purple-500">
                            {parsed.total_faces}
                          </div>
                          <div className="text-xs text-muted-foreground">Faces Detected</div>
                        </div>
                      )}

                      {parsed.total_labels && (
                        <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                          <div className="text-2xl font-bold text-blue-500">
                            {parsed.total_labels}
                          </div>
                          <div className="text-xs text-muted-foreground">Labels Found</div>
                        </div>
                      )}

                      {/* Copy Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
                        }}
                      >
                        📋 Copy JSON to Clipboard
                      </Button>
                    </div>
                  );
                } catch (e) {
                  // Not JSON, display as text
                  return (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                        {result.result}
                      </div>
                    </div>
                  );
                }
              })()}

                            <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>Analysis completed at {new Date(result.timestamp).toLocaleString()}</span>
                <span className="px-2 py-1 bg-muted rounded">
                  ✨ {result.model}
                </span>
              </div>
            </Card>
          ) : (
            <Card className="p-6 border-red-500/20 bg-red-500/5">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">❌</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                      Analysis Failed
                    </h3>
                    <div className="text-sm whitespace-pre-wrap text-red-700 dark:text-red-300 leading-relaxed">
                      {result.error}
                    </div>
                  </div>
                </div>

                {result.isRateLimitError && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                      💡 Rekomendasi:
                    </div>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                      <li>Gunakan model "Gemini 2.0 Flash (Native)" - selalu available</li>
                      <li>Atau tunggu 1-2 menit dan coba lagi</li>
                    </ul>
                  </div>
                )}

                {result.isModelError && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                      💡 Tip:
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      Pilih model lain dari daftar yang tersedia di atas.
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setSelectedModel('gemini-native'); // Switch to native Gemini
                  }}
                >
                  🔄 Try Again with Gemini Native
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
