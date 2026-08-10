/**
 * A dialable `tel:` href.
 *
 * Everything a human uses to read a number — spaces, hyphens, brackets — is
 * meaningless to a dialer and, worse, is inconsistently handled by them. The
 * displayed string keeps its formatting; the href gets the digits.
 *
 * A leading `+` is kept, because it is the only character in a phone number
 * that carries meaning to a dialer.
 */
export function telHref(number: string): string {
  const trimmed = number.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}
