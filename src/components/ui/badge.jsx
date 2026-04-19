import * as React from 'react';
import { cn } from '@/lib/utils';

const Badge = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground',
    success: 'border-transparent bg-emerald-600 text-white',
    warning: 'border-transparent bg-yellow-600 text-white',
    muted: 'border-transparent bg-muted text-muted-foreground',
  };
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export { Badge };
