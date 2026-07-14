import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useUIStore } from '@/lib/store/ui-store';
import { ArrowLeft, Undo, Redo, PenTool, Type, Circle, X } from 'lucide-react';
import { ImageAttachment } from '@/types';

type Tool = 'sketch' | 'text';

const getColorFromSlider = (val: number) => {
  if (val <= 5) return '#ffffff';
  if (val >= 95) return '#000000';
  const hue = ((val - 5) / 90) * 360;
  return `hsl(${hue}, 100%, 50%)`;
};

export const ImageAnnotator: React.FC = () => {
  const ui = useUIStore();
  const image = ui.annotatingImage;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('sketch');
  const [sliderValue, setSliderValue] = useState<number>(15);
  const [activeColor, setActiveColor] = useState(getColorFromSlider(15));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSliderValue(val);
    setActiveColor(getColorFromSlider(val));
  };
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  
  // Text state
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas with image
  useEffect(() => {
    if (!image || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate scaled dimensions to fit container
      const container = containerRef.current!;
      const maxWidth = container.clientWidth - 40;
      const maxHeight = container.clientHeight - 40;
      
      let width = img.width;
      let height = img.height;
      
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      if (ratio < 1) {
        width = width * ratio;
        height = height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Save initial state
      const initialData = ctx.getImageData(0, 0, width, height);
      setHistory([initialData]);
      setHistoryStep(0);
    };
    img.src = image.preview || image.url;
  }, [image]);

  useEffect(() => {
    if (textInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput]);

  const saveState = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(data);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0 && canvasRef.current) {
      const step = historyStep - 1;
      setHistoryStep(step);
      canvasRef.current.getContext('2d')?.putImageData(history[step], 0, 0);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1 && canvasRef.current) {
      const step = historyStep + 1;
      setHistoryStep(step);
      canvasRef.current.getContext('2d')?.putImageData(history[step], 0, 0);
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool !== 'sketch' || !canvasRef.current) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || activeTool !== 'sketch' || !canvasRef.current) return;
    e.preventDefault(); // Prevent scrolling on touch
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing && activeTool === 'sketch' && canvasRef.current) {
      setIsDrawing(false);
      canvasRef.current.getContext('2d')?.closePath();
      saveState();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool === 'text') {
      if (textInput) {
        commitText(); // commit existing text if clicking elsewhere
      } else {
        const coords = getCoordinates(e);
        setTextInput({ x: coords.x, y: coords.y, value: '' });
      }
    }
  };

  const commitText = () => {
    if (!textInput || !textInput.value.trim() || !canvasRef.current) {
      setTextInput(null);
      return;
    }
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.font = '24px Arial, sans-serif';
      ctx.fillStyle = activeColor;
      ctx.textBaseline = 'top';
      ctx.fillText(textInput.value, textInput.x, textInput.y);
      saveState();
    }
    setTextInput(null);
  };

  const handleSave = () => {
    if (!canvasRef.current || !image) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    ui.updateAttachedImage(image.id, { preview: dataUrl, url: dataUrl });
    ui.setAnnotatingImage(null);
  };

  if (!image) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white/95 dark:bg-[#000000]/95 backdrop-blur flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 shrink-0">
        <button 
          onClick={() => ui.setAnnotatingImage(null)}
          className="text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleUndo} 
            disabled={historyStep <= 0}
            className="text-gray-700 dark:text-white disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <Undo size={18} />
          </button>
          <button 
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="text-gray-700 dark:text-white disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <Redo size={18} />
          </button>
        </div>
        <button 
          onClick={handleSave}
          className="bg-[#1a6adf] text-white hover:bg-[#1a6adf]/90 dark:bg-white dark:text-black px-4 py-1.5 rounded-full text-sm font-medium dark:hover:bg-gray-200 transition-colors"
        >
          Simpan
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Workspace */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center relative bg-gray-50/50 dark:bg-gray-900/20"
        >
          <div className="relative shadow-2xl rounded overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onClick={handleCanvasClick}
              className="touch-none cursor-crosshair bg-white"
            />
            {textInput && (
              <input
                ref={inputRef}
                type="text"
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => e.key === 'Enter' && commitText()}
                className="absolute bg-transparent border-0 outline-none whitespace-nowrap p-0 m-0 leading-none"
                style={{
                  left: `${textInput.x}px`,
                  top: `${textInput.y}px`,
                  color: activeColor,
                  font: '24px Arial, sans-serif',
                  transform: 'translateY(-2px)' // slight visual adjustment to match canvas baseline
                }}
              />
            )}
          </div>
        </div>

        {/* Toolbar (Floating bottom center) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
          {/* Colors Slider */}
          <div className="flex items-center bg-white dark:bg-[#1e2330] p-2 px-4 rounded-full shadow-xl border border-gray-200 dark:border-white/10 w-72 h-12">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={handleSliderChange}
              className="w-full h-4 appearance-none rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-200 dark:[&::-webkit-slider-thumb]:border-gray-400 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-200"
              style={{
                background: `linear-gradient(to right, 
                  #ffffff 0%, 
                  #ffffff 5%, 
                  #ff0000 5%, 
                  #ffff00 20%, 
                  #00ff00 35%, 
                  #00ffff 50%, 
                  #0000ff 65%, 
                  #ff00ff 80%, 
                  #ff0000 95%, 
                  #000000 95%, 
                  #000000 100%
                )`
              }}
            />
            {/* Active Color Preview Indicator */}
            <div 
              className="w-6 h-6 rounded-full ml-4 shrink-0 shadow-sm border border-gray-200 dark:border-white/20 transition-colors"
              style={{ backgroundColor: activeColor }}
            />
          </div>
          
          {/* Tools */}
          <div className="flex items-center gap-2 bg-white dark:bg-[#1e2330] p-2 rounded-full shadow-xl border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setActiveTool('sketch')}
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-colors ${activeTool === 'sketch' ? 'bg-gray-100 text-gray-900 dark:bg-white/20 dark:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'}`}
            >
              <PenTool size={20} className="mb-1" />
              <span className="text-[10px]">Sketsa</span>
            </button>
            <button
              onClick={() => setActiveTool('text')}
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-colors ${activeTool === 'text' ? 'bg-gray-100 text-gray-900 dark:bg-white/20 dark:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'}`}
            >
              <Type size={20} className="mb-1" />
              <span className="text-[10px]">Teks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
