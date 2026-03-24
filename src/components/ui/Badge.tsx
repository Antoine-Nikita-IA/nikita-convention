import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/database';
import type { SessionStatus, EtapeStatut } from '@/types/database';

export function StatusBadge({ status, size = 'md' }: { status: SessionStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', STATUS_COLORS[status], size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs')}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const ETAPE_COLORS: Record<EtapeStatut, string> = { a_venir: 'bg-gray-100 text-gray-600', en_cours: 'bg-blue-100 text-blue-700', complete: 'bg-green-100 text-green-700', bloquee: 'bg-red-100 text-red-700' };
const ETAPE_LABELS_MAP: Record<EtapeStatut, string> = { a_venir: 'À venir', en_cours: 'En cours', complete: 'Complété', bloquee: 'Bloqué' };

export function EtapeBadge({ statut }: { statut: EtapeStatut }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', ETAPE_COLORS[statut])}>{ETAPE_LABELS_MAP[statut]}</span>;
}
