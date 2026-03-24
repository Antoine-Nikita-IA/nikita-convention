import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: fr });
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy à HH:mm', { locale: fr });
  } catch {
    return '—';
  }
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateConventionNumero(index: number): string {
  const year = new Date().getFullYear();
  return `CONV-${year}-${String(index).padStart(3, '0')}`;
}

export function calculateTTC(ht: number): number {
  return Math.round(ht * 1.2);
}

export function calculateTVA(ht: number): number {
  return Math.round(ht * 0.2);
}

export function getMinFormationDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

export function getClientFromSession(session: { client?: any }): any | null {
  if (!session.client) return null;
  return Array.isArray(session.client) ? session.client[0] : session.client;
}
