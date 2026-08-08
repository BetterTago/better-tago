import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Conditional class names that de-duplicate correctly against Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
