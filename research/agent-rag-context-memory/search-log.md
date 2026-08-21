# Search log (append only)

This log was created during the 2026-07-20 structural migration. The initial discovery/search process is documented **retrospectively**. Exact original queries, dates, filters, returned-result counts, screening counts, and exclusion counts were not retained; they are marked unknown rather than reconstructed or fabricated.

## Append-only rules

- Append a new row for every search, citation-chain pass, correction, or retraction check.
- Never edit or delete a historical row. Correct an error with a new row that names the superseded query ID.
- Preserve exact query syntax, database/index, date, filters, result count before deduplication, operator, and screening disposition.
- A discovery source is not automatically evidence; numerical claims require the primary artifact and an ME record.

| Query ID | Date | Database/index or discovery channel | Exact query | Filters | Results | Screening/disposition | Notes |
|---|---|---|---|---|---:|---|---|
| RQ-R01 | unknown—not retained | multiple scholarly/web indexes; exact list not retained | unknown—not retained | unknown—not retained | unknown—not retained | Produced part of the surviving M01–M34 included set; stage counts and exclusions unknown | Retrospective record of initial topic discovery. It is not reproducible and cannot support an exhaustive absence claim. |
| RQ-R02 | unknown—not retained | backward/forward citation chaining and related-work discovery | unknown—not retained | unknown—not retained | unknown—not retained | Included works cannot be assigned reliably to individual chain parents | Retrospective only; chain direction, dates, and counts were not retained. |
| RQ-R03 | 2026-07-20 | arXiv, DOI, OpenReview, ACL Anthology, PMLR, USENIX/proceedings metadata as applicable | exact per-work identity/version checks; combined query strings not retained | identity, venue, version, and locator verification | 34 included topic records checked; returned search-result count unknown | Metadata/locator audit; no new denominator for discovery screening | The independent audit is described in `../REVIEW-2026-07-20.md`. This row records its effect on this topic without inventing exact search strings or result counts. |
| RQ-M01 | 2026-07-20 | local topic corpus | mechanical migration check over M01–M34, MC001–MC044, and ME records | local Markdown only | 34 source records; 44 claim rows | Structural migration; not a literature search | Created methods/search provenance and traceability records. No new source was added. |

## Retrospective screening totals

| Stage | Included | Excluded | Duplicates | Notes |
|---|---:|---:|---:|---|
| Search results | unknown—not retained | unknown—not retained | unknown—not retained | Exact original result universe is unavailable. |
| Title/abstract | unknown—not retained | unknown—not retained | unknown—not retained | Do not infer counts from the final bibliography. |
| Full text | 34 topic source records survive | unknown—not retained | unknown—not retained | M08 and M09 are background/qualifying records; the others provide core evidence. |

## Absence-claim universe at migration

MC044 is bounded to the 34 included source records, versions and acquisition extents documented in their source notes, plus the non-reproducible retrospective process above. Because exact original queries and screening counts are unknown, this universe can show only that the reviewed corpus did not contain an eligible end-to-end controlled guarantee; it cannot show that no such work exists elsewhere.
