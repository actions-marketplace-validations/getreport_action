# getReport GitHub Action

Run a free [getReport](https://getreport.app) website checkup from CI, and fail the job when a score drops below your minimum. Every run links to the full report, with a plain-language fix for each finding.

```yaml
- uses: getreport/action@v1
  with:
    url: https://example.com/
    api-key: ${{ secrets.GETREPORT_API_KEY }}
    min-score: 80
    thresholds: speed=70, seo=90, security=70
```

Get a free API key at <https://getreport.app/api> and store it as the `GETREPORT_API_KEY` secret.

| Input | Default | |
| --- | --- | --- |
| `url` | required | The page to check (a preview deployment URL works). |
| `api-key` | required | Your key; it is masked in the log. |
| `min-score` | `0` | Fail below this overall score. `0` never fails. |
| `thresholds` | | Per-module minimums: `speed`, `seo`, `security`, `a11y`, `schema`, `social`, `practices`. |
| `device` | `mobile` | `mobile` or `desktop`. |
| `fresh` | `true` | `false` reuses a report from the last 12 hours (it does not count against your key). |
| `timeout-minutes` | `8` | Give up after this long. |

Outputs: `report-url`, `report-id`, `overall`, `grade`, `scores` (JSON). The job summary shows every score against its minimum.

A module that could not be checked fails only if you set a minimum for it. The action has no dependencies and runs on `node20`.

---

Source: the getReport monorepo (`integrations/github-action`). Issues and questions: hello@getreport.app.
