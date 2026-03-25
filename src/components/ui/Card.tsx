import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps { children: ReactNode; className?: string; onClick?: () => void; }
export function Card({ children, className, onClick }: CardProps) {
  return <div className={cn('card', onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)} onClick={onClick}>{children}</div>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4 border-b border-gray-100 dark:border-gray-700', className)}>{children}</div>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

interface KPICardProps { label: string; value: string | number; icon?: ReactNode; color?: string; }
export function KPICard({ label, value, icon, color }: KPICardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        {icon && <span className={cn('opacity-60', color)}>{icon}</span>}
      </div>
      <div className={cn('text-2xl font-bold', color || 'text-gray-800 dark:text-white')}>{value}</div>
    </div>
  );
}
