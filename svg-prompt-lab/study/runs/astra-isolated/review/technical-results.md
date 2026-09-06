# Technical results

These are contract checks, not aesthetic scores. All planned candidates remain in the denominator. A pass does not establish full animation compatibility.

| Recipe / phase | Planned | Passed | Contract failed | Render failed | Missing | Warnings | Median bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Minimal contract | 6 | 6 | 0 | 0 | 0 | 1 | 4656.5 |
| Current browser recipe | 6 | 6 | 0 | 0 | 0 | 0 | 4065.5 |
| Art direction | 6 | 6 | 0 | 0 | 0 | 0 | 3374 |
| Scene/component/layout plan | 6 | 6 | 0 | 0 | 0 | 0 | 4326 |
| Same-category SVG example | 6 | 6 | 0 | 0 | 0 | 1 | 4224.5 |
| Current agent guide | 6 | 6 | 0 | 0 | 0 | 1 | 4552 |
| Current agent: second fresh draft | 6 | 6 | 0 | 0 | 0 | 0 | 4812 |
| Current agent: visual revision | 6 | 6 | 0 | 0 | 0 | 0 | 4578 |

## Paired controls

Use each row to compare the same brief. IDs are shown here only after blind judging. The gallery hides recipes by default.

| Brief | Current agent | Browser | Minimal | Art direction | Layout plan | Reference | Second agent draft | Revision of first agent draft |
|---|---|---|---|---|---|---|---|---|
| Pelican stagehand | t043 | t002 | t001 | t003 | t004 | t005 | t031 | t037 |
| Mushroom chef | t044 | t007 | t006 | t008 | t009 | t010 | t032 | t038 |
| Bureaucratic cuckoo clock | t045 | t012 | t011 | t013 | t014 | t015 | t033 | t039 |
| Royal teapot | t046 | t017 | t016 | t018 | t019 | t020 | t034 | t040 |
| Underwater laundromat | t047 | t022 | t021 | t023 | t024 | t025 | t035 | t041 |
| Moon permit office | t048 | t027 | t026 | t028 | t029 | t030 | t036 | t042 |

## Review flags

- **t011** (passed): Geometry approaches the canvas edge; inspect stroke clipping and safe margin

- **t015** (passed): Geometry approaches the canvas edge; inspect stroke clipping and safe margin

- **t044** (passed): Geometry approaches the canvas edge; inspect stroke clipping and safe margin

## Human assessment

Not yet collected. No aesthetic winner or improvement rate is inferred from technical pass rates. Export ratings from the review after comparing all six briefs. Analyze each axis separately against the current agent control; retain the browser comparison. For the two-candidate workflows, compare the preferred original-or-revised result against the preferred original-or-second-fresh-draft result, and record ties and revision regressions. Candidate count is matched; tokens and inference time are not.
