# Source documents

Every page in this portal restates something the Municipality of Tago published. This folder is where the
citations for those restatements are written down in prose — one file per body of source material, describing
what was retrieved, from where, on what date, and what was checked against it.

The retrieved documents themselves (charter PDFs, posted notices, photographs of a wall) are kept **outside
version control**, under a git-ignored `sources/` directory at the repository root. They are the municipality's
documents; this project keeps a copy so a transcription can always be re-checked against what was actually
published, but it does not redistribute them. What is redistributed is the transcription — with attribution
and a link back to the official original on every page.

## What a source note records

- The document title, exactly as published.
- The URL it was retrieved from, and the retrieval date.
- Which pages in this portal were derived from it.
- The verification level (`V3`–`V0`) and why.
- Anything the document is silent on or ambiguous about — and what was asked, of whom, to close it.

## What is not recorded here

The name of any person. Refer to the **role** — "the Municipal Civil Registrar", "the Division Head". Names
belong in `content/` or `config/lgu.config.json`, beside a source and a date, where a single change corrects
them after an election.
