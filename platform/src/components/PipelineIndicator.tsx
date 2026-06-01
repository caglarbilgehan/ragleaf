import React from 'react';
import { CheckCircle, Circle, XCircle, Loader2 } from 'lucide-react';

interface Stage {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
}

interface PipelineIndicatorProps {
  status: string;
  compact?: boolean;
}

const PipelineIndicator: React.FC<PipelineIndicatorProps> = ({ status, compact = false }) => {
  // Map document status to pipeline stages (Upload → Process → Index)
  const stages: Stage[] = [
    {
      id: 'upload',
      label: 'Upload',
      status: ['uploaded', 'processing', 'processed', 'enriched', 'indexing', 'indexed'].includes(status)
        ? 'completed'
        : status === 'error'
        ? 'error'
        : 'pending',
    },
    {
      id: 'process',
      label: 'Process',
      status:
        status === 'processing'
          ? 'current'
          : ['processed', 'enriched', 'indexing', 'indexed'].includes(status)
          ? 'completed'
          : status === 'error'
          ? 'error'
          : 'pending',
    },
    {
      id: 'index',
      label: 'Index',
      status:
        status === 'indexing'
          ? 'current'
          : status === 'indexed'
          ? 'completed'
          : status === 'error'
          ? 'error'
          : 'pending',
    },
  ];

  const getStageIcon = (stage: Stage) => {
    switch (stage.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'current':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  if (compact) {
    // Mobile/compact view: Show only current stage
    const currentStage = stages.find((s) => s.status === 'current') || stages[stages.length - 1];
    return (
      <div className="flex items-center gap-2">
        {getStageIcon(currentStage)}
        <span className="text-sm text-gray-700">{currentStage.label}</span>
      </div>
    );
  }

  // Desktop view: Show all stages
  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.id}>
          <div className="flex items-center gap-1">
            {getStageIcon(stage)}
            <span
              className={`text-sm ${
                stage.status === 'completed'
                  ? 'text-green-600'
                  : stage.status === 'current'
                  ? 'text-blue-600 font-medium'
                  : stage.status === 'error'
                  ? 'text-red-600'
                  : 'text-gray-400'
              }`}
            >
              {stage.label}
            </span>
          </div>
          {index < stages.length - 1 && (
            <div
              className={`w-8 h-0.5 ${
                stage.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default PipelineIndicator;
