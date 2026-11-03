import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

export const Badge = ({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) => {
  const variants = {
    default: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    destructive: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    outline: 'border border-slate-700 text-slate-300',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
};
