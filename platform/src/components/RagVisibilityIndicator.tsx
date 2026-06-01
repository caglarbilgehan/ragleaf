import React from 'react';
import { CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';

export type RagAccessStatus = 'accessible' | 'inaccessible' | 'not_ready';

export interface RagVisibilityIndicatorProps {
  status: RagAccessStatus;
  reason: string;
  showTooltip?: boolean;
  className?: string;
}

/**
 * RAG Görünürlük Göstergesi Bileşeni
 * 
 * Kullanıcının bir dökümanı RAG sorgularında kullanıp kullanamayacağını
 * görsel olarak gösterir. Üç farklı durum destekler:
 * - accessible: Yeşil, kullanıcı bu dökümanı RAG'da kullanabilir
 * - inaccessible: Kırmızı, departman erişimi yok
 * - not_ready: Sarı, döküman henüz hazır değil
 */
const RagVisibilityIndicator: React.FC<RagVisibilityIndicatorProps> = ({
  status,
  reason,
  showTooltip = true,
  className = ''
}) => {
  const getStatusConfig = (status: RagAccessStatus) => {
    switch (status) {
      case 'accessible':
        return {
          icon: CheckCircle,
          text: 'RAG Erişilebilir',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          borderColor: 'border-green-200'
        };
      case 'inaccessible':
        return {
          icon: XCircle,
          text: 'RAG Erişilemez',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          borderColor: 'border-red-200'
        };
      case 'not_ready':
        return {
          icon: Clock,
          text: 'RAG Hazır Değil',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          borderColor: 'border-yellow-200'
        };
      default:
        return {
          icon: HelpCircle,
          text: 'Bilinmeyen Durum',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const badgeContent = (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
        ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}
      `}
      role="status"
      aria-label={`RAG durumu: ${config.text}. ${reason}`}
    >
      <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} aria-hidden="true" />
      <span className="whitespace-nowrap">{config.text}</span>
    </span>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <div className="relative group">
      {badgeContent}
      
      {/* Tooltip */}
      <div
        className="
          absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
          invisible group-hover:visible opacity-0 group-hover:opacity-100
          transition-all duration-200 z-50
        "
        role="tooltip"
      >
        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-xs text-center shadow-lg">
          <div className="font-medium mb-1">{config.text}</div>
          <div className="text-gray-300">{reason}</div>
          
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RagVisibilityIndicator;