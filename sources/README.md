# `sources/` — the retrieved originals, kept but not redistributed

**This is the only file in here that is committed.** Everything else — the Citizen's Charter PDFs, and any
notice or photograph retrieved later — is deliberately outside version control. If you cloned this repository,
this folder is empty apart from this file, and that is correct.

## Why keep them at all

A transcription can only be defended if it can be re-checked against **what was actually published on the day
it was made**. Without a copy, a charter revision leaves no way to tell what changed, and a fee that is wrong
today is indistinguishable from a fee that was always wrong.

So a copy is kept, with a `sha256`. That checksum is what makes a later revision **detectable** rather than
assumed: re-run the harvest, and a changed hash tells you a document moved before anybody notices a figure is
out of date.

## Why they are not committed

They are the Municipality of Tago's documents. This project keeps a working copy; it does not redistribute
them.

What this project republishes is **the transcription** — with attribution, the retrieval date, and a link back
to the official original, so a reader can always go to the source rather than take this portal's word for it.
No archived document is republished in whole.

## Rebuilding it

```bash
npm run harvest
```

That walks the municipality's official sitemap, retrieves every charter document, writes them here, and
regenerates the machine-readable inventory and the source notes under `inventory/`. It needs `pdftotext`
(`poppler-utils` on Debian/Ubuntu, `poppler` via Homebrew on macOS).

The harvester reads a public site and identifies itself as this project. It respects `robots.txt` — **if that
file ever changes to disallow, the harvester stops.** The current permission is a fact with a date on it, not a
standing right.

## What is recorded about each document

In `inventory/charter-documents.yaml` and `inventory/source-notes.md`, never here:

- the document title **exactly as the municipality publishes it** — never derived from a filename, which would
  put words in their mouth;
- the URL it came from, the date it was retrieved, its `sha256` and its size;
- what was derived from it.

## No names

Nothing recorded about these documents names a person. The charter's `PERSON RESPONSIBLE` column is
deliberately not captured — refer to the **office** instead. A name belongs in `content/` or
`config/lgu.config.json`, beside a source and a check date, where a single change corrects it after an
election.
