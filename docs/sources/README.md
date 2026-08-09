# Source documents

Every page in this portal restates something the Municipality of Tago published, and every restatement is
written down beside the document it came from.

**Source notes are generated, not hand-written.** `npm run harvest` walks the official municipal site and emits
one note per document to `inventory/source-notes.md`, alongside the machine-readable inventory it builds. This
folder holds the convention those notes follow and anything that has to be recorded by hand.

The retrieved documents themselves are kept **outside version control**, under a git-ignored `sources/`
directory at the repository root, in three folders:

| Folder                  | What it holds                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `sources/charter/`      | The 22 Citizen's Charter PDFs                                                                           |
| `sources/site/`         | The HTML of the reference pages the profile, history, tourism and transparency records are written from |
| `sources/transparency/` | Every document linked from the Transparency Seal page                                                   |

⚠️ **A page and a document are not checksummed the same way.** A document is hashed over its bytes; a page is
hashed over its **published text**, because this site stamps every response with a fresh timestamp and a
full-HTML hash would report every page as changed on every run. See `inventory/README.md` § Checksums. They are the municipality's
documents; this project keeps a copy — with a checksum, so a later revision is _detectable_ rather than assumed —
so a transcription can always be re-checked against what was actually published, but it does not redistribute
them.

## What a source note records

- The document title, **exactly as the municipality publishes it** — never derived from a filename, which would
  put words in their mouth.
- The URL it was retrieved from, the retrieval date, and the checksum of what was retrieved.
- Which pages in this portal were derived from it.
- The verification level and why. The levels are defined in
  [`../governance.md`](../governance.md) — one place, deliberately.
- Anything the document is silent on or ambiguous about, recorded as a gap rather than resolved by guessing.

## What is not recorded here

The name of any person. Refer to the **role** — "the Municipal Civil Registrar", "the Division Head". Names
belong in `content/` or `config/lgu.config.json`, beside a source and a date, where a single change corrects
them after an election.
