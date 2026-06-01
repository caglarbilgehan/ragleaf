import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface QualityIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function QualityIndicator({
  confidence,
  showLabel = true,
  showTooltip = true,
  size = 'md',
}: QualityIndicatorProps) {
  const getConfig = (conf: number) => {
    if (conf >= 80) {
      return {
        color: 'text-green-600 bg-green-100 border-green-200',
        icon: CheckCircle,
        label: 'Yüksek Kalite',
        tooltip: 'OCR metni yüksek güvenilirlikte çıkarıldı. Düzenleme gerekmeyebilir.',
      };
    }
    if (conf >= 50) {
      return {
        color: 'text-yellow-600 bg-yellow-100 border-yellow-200',
        icon: AlertTriangle,
        label: 'Orta Kalite',
        tooltip: 'OCR metni orta güvenilirlikte. Bazı hatalar olabilir, kontrol önerilir.',
      };
    }
    return {
      color: 'text-red-600 bg-red-100 border-red-200',
      icon: XCircle,
      label: 'Düşük Kalite',
      tooltip: 'OCR metni düşük güvenilirlikte. Manuel düzenleme önerilir.',
    };
  };

  const config = getConfig(confidence);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };

  return (
    <div className="relative group inline-flex">
      <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.color} ${sizeClasses[size]}`}>
        <Icon className={iconSizes[size]} />
        {showLabel && <span>{config.label}</span>}
        <span className="font-bold">{confidence.toFixed(0)}%</span>
      </span>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
          {config.tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}