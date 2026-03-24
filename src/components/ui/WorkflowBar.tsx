import { cn } from '@/lib/utils';
import { WORKFLOW_ORDER, STATUS_LABELS } from '@/types/database';
import type { SessionStatus } from '@/types/database';
import { Check } from 'lucide-react';

export function WorkflowBar({ currentStatus, className }: { currentStatus: SessionStatus; className?: string }) {
  const currentIndex = WORKFLOW_ORDER.indexOf(currentStatus);
  const isAnnule = currentStatus === 'annule';
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {WORKFLOW_ORDER.map((status, index) => {
        const isCompleted = !isAnnule && index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <div key={status} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                isCompleted && 'bg-green-500 text-white',
                isActive && !isAnnule && 'bg-nikita-pink text-white ring-2 ring-nikita-pink ring-offset-2',
                isActive && isAnnule && 'bg-red-500 text-white',
                !isCompleted && !isActive && 'bg-gray-200 text-gray-500'
              )}>
                {isCompleted ? <Check size={14} /> : index + 1}
              </div>
              <span className={cn('text-[10px] mt-1 text-center leading-tight', isActive ? 'font-semibold text-gray-800' : 'text-gray-500')}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            {index < WORKFLOW_ORDER.length - 1 && <div className={cn('h-0.5 flex-1 mx-1 mt-[-16px]', isCompleted ? 'bg-green-500' : 'bg-gray-200')} />}
          </div>
        );
      })}
    </div>
  );
}
