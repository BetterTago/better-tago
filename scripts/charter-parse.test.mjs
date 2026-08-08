import { describe, expect, it } from 'vitest';
import { parseCharter } from './charter-parse.mjs';

/**
 * Every fixture here is INVENTED. No real Tago service, office, fee or person
 * appears in this file — a fixture is exactly where a made-up civic fact would
 * slip past review and end up looking sourced.
 *
 * The layouts, though, are real: each one reproduces a shape that actually
 * occurs in the published charter, including the two that produced confidently
 * wrong numbers before these tests existed.
 */

/** The common executive layout: colon labels, numbered service headings. */
const STANDARD = `
                         Example Office
                        External Services

1. Request a sample certificate
      A one-line description of the sample service.

 Office or Division:      Example Office
 Classification:          Simple
 Type of Transaction:     G2C – Government to Citizen
 Who may avail:           Anyone in the sample municipality

              CHECKLIST OF REQUIREMENTS                    WHERE TO SECURE
 1. Sample letter of request                               Any sample office

     CLIENT STEPS            AGENCY ACTION      FEES TO BE PAID   PROCESSING   PERSON
                                                                     TIME   RESPONSIBLE
 1. Submit the sample form.  1. Receive it.          None        5 minutes    Sample Role

                                              TOTAL    None      5 minutes
`;

describe('parseCharter — the standard executive layout', () => {
  const [service] = parseCharter(STANDARD);

  it('finds exactly one service', () => {
    expect(parseCharter(STANDARD)).toHaveLength(1);
  });

  it('reads the title from the numbered heading', () => {
    expect(service.title).toBe('Request a sample certificate');
    expect(service.number).toBe(1);
    expect(service.titleStatus).toBe('extracted');
  });

  it('reads the section, the office and the eligibility', () => {
    expect(service.section).toBe('external');
    expect(service.office).toBe('Example Office');
    expect(service.fields.eligibility).toBe('present');
  });

  it('records every field as present or absent and nothing else', () => {
    expect(
      Object.values(service.fields).every(
        v => v === 'present' || v === 'absent'
      )
    ).toBe(true);
  });

  it('records output as absent — the layout has no such field', () => {
    expect(service.fields.output).toBe('absent');
  });
});

describe('the wrapped, interleaved column header', () => {
  /*
   * The regression that matters most. `PROCESSING` and `TIME` land on separate
   * lines with `PERSON` between them, and `FEES TO BE` is split from `PAID`.
   * Matching those as adjacent phrases reported both columns missing on 74 of
   * 96 real services — a bug that would have been published as a finding about
   * the municipality rather than about this parser.
   */
  const WRAPPED = `
                        Example Office
                       External Services

1. A sample service with a wrapped header

 Office or Division:   Example Office
 Who may avail:        Anyone

        CHECKLIST OF REQUIREMENTS                 WHERE TO SECURE
 1. A sample requirement                          A sample place

   CLIENT STEPS        AGENCY ACTION      FEES TO BE   PROCESSING        PERSON
                                             PAID         TIME       RESPONSIBLE
 1. Do the thing.      1. Do the other.      None      10 minutes     Sample Role
`;

  it('still finds the fees and processing-time columns', () => {
    const [service] = parseCharter(WRAPPED);
    expect(service.fields.fees).toBe('present');
    expect(service.fields.processingTime).toBe('present');
  });

  /*
   * Letter-spacing in the PDF can put a space INSIDE a word — `PROCESSIN G`
   * occurs in a real charter — which made one service look like it stated no
   * processing time when its table plainly has the column.
   */
  const KERNED = WRAPPED.replace('PROCESSING', 'PROCESSIN G');

  it('survives a space inside a column-header word', () => {
    const [service] = parseCharter(KERNED);
    expect(service.fields.processingTime).toBe('present');
  });
});

describe('the legislative layout variant', () => {
  /* Caps labels, no colon, section name sharing the office-name line, and no
   * numbered heading anywhere. This shape parsed as ZERO services before. */
  const LEGISLATIVE = `
        Example Legislative Body External Services


OFFICE OR DIVISION            EXAMPLE LEGISLATIVE BODY

CLASSIFICATION                Simple

TYPE OF TRANSACTION           G2C – Government to Citizen

WHO MAY AVAIL                 Individuals and sample organisations

              CHECKLIST OF REQUIREMENTS                    WHERE TO SECURE

   A sample document with its sample attachments           A sample office

     CLIENT STEPS         AGENCY ACTIONS      FEES TO BE PAID   PROCESSING TIME
 1. Ask for the thing.    Review the thing.        None            2 days
`;

  const [service] = parseCharter(LEGISLATIVE);

  it('finds the service despite the colon-less caps labels', () => {
    expect(parseCharter(LEGISLATIVE)).toHaveLength(1);
    expect(service.office).toBe('EXAMPLE LEGISLATIVE BODY');
  });

  it('reads the section from a line it shares with the office name', () => {
    expect(service.section).toBe('external');
  });

  it('flags the missing title instead of inventing one', () => {
    expect(service.title).toBeNull();
    expect(service.titleStatus).toBe('not-in-layout');
  });
});

describe('a section header wrapped across two lines', () => {
  /* One real document breaks `... Office Division External` / `Services` over
   * a line end, which left its services with no section at all. */
  const WRAPPED_SECTION = `
     Example Office of the Sample Division External
     Services

1. A sample service

 Office or Division:   Example Office
 Who may avail:        Anyone

     CLIENT STEPS      AGENCY ACTION    FEES TO BE PAID   PROCESSING TIME
 1. Do it.             1. Done.              None            1 day
`;

  it('still resolves the section', () => {
    expect(parseCharter(WRAPPED_SECTION)[0].section).toBe('external');
  });
});

describe('what must NOT be counted as a service', () => {
  /*
   * The over-counting regression. Numbered requirement items look exactly like
   * numbered service headings; only the Office-or-Division field separates a
   * real service from a checklist row.
   */
  const MANY_NUMBERED_ITEMS = `
                       Example Office
                      External Services

1. The only real service here

 Office or Division:   Example Office
 Who may avail:        Anyone

              CHECKLIST OF REQUIREMENTS               WHERE TO SECURE
 1. A sample letter of request                        A sample office
 2. A sample valid identification card                A sample agency
 3. A sample proof of payment                         A sample counter

     CLIENT STEPS      AGENCY ACTION    FEES TO BE PAID   PROCESSING TIME
 1. Submit.            1. Receive.           None            1 day
 2. Wait.              2. Process.           None            2 days
`;

  it('counts one service, not one per numbered line', () => {
    const services = parseCharter(MANY_NUMBERED_ITEMS);
    expect(services).toHaveLength(1);
    expect(services[0].title).toBe('The only real service here');
  });

  it('does not borrow a requirement row as a title', () => {
    expect(parseCharter(MANY_NUMBERED_ITEMS)[0].title).not.toMatch(
      /letter of request/i
    );
  });
});

describe('sections within one document', () => {
  const BOTH = `
                    Example Office
                   External Services

1. A sample external service

 Office or Division:   Example Office
 Who may avail:        Any resident

     CLIENT STEPS      AGENCY ACTION    FEES TO BE PAID   PROCESSING TIME
 1. Ask.               1. Answer.            None            1 day

                    Example Office
                   Internal Services

1. A sample internal service

 Office or Division:   Example Office
 Who may avail:        Other sample offices

     CLIENT STEPS      AGENCY ACTION    FEES TO BE PAID   PROCESSING TIME
 1. Ask.               1. Answer.            None            1 day
`;

  it('separates external from internal, which decides what a resident sees', () => {
    const services = parseCharter(BOTH);
    expect(services.map(service => service.section)).toEqual([
      'external',
      'internal',
    ]);
  });
});

describe('degenerate input', () => {
  it('returns nothing rather than throwing on an empty document', () => {
    expect(parseCharter('')).toEqual([]);
  });

  it('returns nothing for a document with no service blocks', () => {
    expect(parseCharter('Just some prose.\nAnd another line.\n')).toEqual([]);
  });
});
