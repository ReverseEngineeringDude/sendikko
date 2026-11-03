import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl backdrop-blur-md p-6 transition-all',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
