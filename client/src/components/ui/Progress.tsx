import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressProps {
  value: number; // 0 to 100
  className?: string;
  indicatorClassName?: string;
}

export const Progress = ({
  value,
  className,
  indicatorClassName,
}: ProgressProps) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={twMerge(
        clsx(
          'relative h-2 w-full overflow-hidden rounded-full bg-slate-800/80',
          className
        )
      )}
    >
      <div
        className={twMerge(
          clsx(
            'h-full w-full flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out',
            indicatorClassName
          )
        )}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </div>
  );
};
