import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The one content measure. Nothing sets its own max-width. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('page-measure', className)}>{children}</div>;
}
