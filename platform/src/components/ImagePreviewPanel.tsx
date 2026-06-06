import { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface ImagePreviewPanelProps {
  imageUrl: string;
  pageNumber: number;
  confidence: number;
  onZoomChange?: (zoom: number) => void;
}

export default function ImagePreviewPanel({
  imageUrl,
  pageNumber,
  confidence,
  onZoomChange,
}: ImagePreviewPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onZoomChange?.(1);
  }, [onZoomChange]);


  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return 'text-green-600 bg-green-100';
    if (conf >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 80) return 'Yüksek Kalite';
    if (conf >= 50) return 'Orta Kalite';
    return 'Düşük Kalite';
  };

  return (
    <div className="bg-dark-700/50 rounded-lg p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-100">Görsel Önizleme - Sayfa {pageNumber}</h4>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
          {getConfidenceLabel(confidence)} ({confidence.toFixed(0)}%)
        </span>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}
          className="p-2 rounded bg-dark-800/60 border border-white/[0.1] hover:bg-dark-700/50 disabled:opacity-50">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-600 min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}
          className="p-2 rounded bg-dark-800/60 border border-white/[0.1] hover:bg-dark-700/50 disabled:opacity-50">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={handleReset}
          className="p-2 rounded bg-dark-800/60 border border-white/[0.1] hover:bg-dark-700/50 ml-2">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Image Container */}
      <div ref={containerRef}
        className="flex-1 bg-dark-800/60 rounded border border-white/[0.06] overflow-hidden relative"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}>
        <div className="absolute inset-0 flex items-center justify-center">
          <img ref={imageRef} src={imageUrl} alt={`Page ${pageNumber}`}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}