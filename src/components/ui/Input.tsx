import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; icon?: ReactNode; }
export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
      <input ref={ref} className={cn('input-field', icon ? 'pl-10' : '', error ? 'border-red-500 focus:ring-red-500' : '', className)} {...props} />
    </div>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string; }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <textarea ref={ref} className={cn('input-field min-h-[80px] resize-y', error && 'border-red-500', className)} {...props} />
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; options: { value: string; label: string }[]; }
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(({ label, error, options, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <select ref={ref} className={cn('input-field', className)} {...props}>
      <option value="">Sélectionner...</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
));
SelectField.displayName = 'SelectField';
