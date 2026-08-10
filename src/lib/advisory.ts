import { getManifest } from '@/lib/content';

export type Advisory = {
  /** Dismissal is remembered against this, never against a boolean. */
  id: string;
  body: string;
};

/**
 * The current advisory, or `null` when there is none.
 *
 * 🔴 **There is none today, and that is the correct state — not a stub.**
 * `CONT-107` established where the municipality actually posts advisories, and
 * nothing this project can cite is published in a machine-readable form. So
 * this reads the content layer and finds an empty section.
 *
 * Adding an advisory is therefore a CONTENT change and not a code change: drop
 * an entry into `content/home/advisories/index.yaml` and the bar appears. That
 * is the same rule every other surface in this portal follows, and it is what
 * keeps a real storm notice from waiting on a deployment.
 *
 * Only the FIRST entry renders. An advisory bar showing two things at once is a
 * bar showing neither, and the ranking question ("which emergency is worse")
 * is not one this project should answer in code.
 */
export async function getAdvisory(): Promise<Advisory | null> {
  const entries = await getManifest('home', 'advisories');
  const current = entries[0];
  if (!current) return null;

  return { id: current.slug, body: current.description };
}
