# [M04] Lost in the Middle: How Language Models Use Long Contexts

- **Work ID / topic aliases:** W036 / M04
- **Authors:** Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang
- **Year / venue:** 2024, Transactions of the Association for Computational Linguistics 12:157–173
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.1162/tacl_a_00638; ACL ID 2024.tacl-1.9
- **Canonical URL:** <https://aclanthology.org/2024.tacl-1.9/>
- **Version reviewed / version date:** TACL 2024 proceedings text
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** ACL primary page and paper evidence inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2024.tacl-1.9/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Controlled evidence that nominal context capacity does not imply position-invariant use.

## Methods and setting

2,655 NaturalQuestions-Open queries with one answer document and Contriever distractors; answer position is manipulated. Six models, greedy decoding. Synthetic UUID retrieval uses 500 examples at each of 75/140/300 pairs. No reruns/CIs. [§§2–4]

## Findings used in this library

- Multi-document QA is U-shaped: best near beginning/end and worse in the middle. GPT-3.5-Turbo lost over 20 points in adverse middle positions and in some 20/30-document cells fell below its 56.1% closed-book score. [Figure 5; §2.3; pp.161–162]
- Increasing 20→50 documents added only ~1.5 GPT-3.5 points and ~1 Claude-1.3 point despite higher retriever recall. [Figure 11; §5; p.166]
- Repeating the query before/after context fixed 300-key literal retrieval for GPT-3.5-16K but did not materially fix multi-document QA. [Figure 9; §4.2; p.164]

## Limitations / validity threats

Static QA and synthetic key lookup, not tool-agent trajectories. Models/API snapshots are old. Position effects may change with architectures and prompt formats; no uncertainty estimates.

## Exact claim/evidence links

- [MC002](../claims/MC002.md) ↔ [ME002](../evidence/ME002.md) — `synthesis.md §Strongest conclusions 1`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
