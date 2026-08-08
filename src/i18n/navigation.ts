import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware `Link` / `redirect` / `useRouter`. Use these, not next/link. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
