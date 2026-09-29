/**
 * The getReport GitHub Action's logic (spec §11 "Integrations", M7; ADR 0046), kept free of any
 * GitHub or network code so it can be tested on its own. No dependencies: the action is copied
 * as is into the public getreport/action repository for the Marketplace.
 */
export const MODULES = ['speed', 'seo', 'security', 'a11y', 'schema', 'social', 'practices'];
export const LABELS = {
  overall: 'Overall',
  speed: 'Speed',
  seo: 'SEO',
  security: 'Security',
  a11y: 'Accessibility',
  schema: 'Structured data',
  social: 'Social',
  practices: 'Best practices',
};
export const FINISHED = ['done', 'partial', 'failed'];

/** "speed=80, seo=90" → { speed: 80, seo: 90 }; throws a plain message on a mistake. */
export function parseThresholds(text) {
  const out = {};
  for (const part of String(text ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^([a-z0-9]+)\s*=\s*(\d{1,3})$/.exec(part);
    if (!m) throw new Error(`thresholds: "${part}" should look like speed=80`);
    const [, mod, n] = m;
    if (!MODULES.includes(mod)) throw new Error(`thresholds: "${mod}" is not a module (${MODULES.join(', ')})`);
    const v = Number(n);
    if (v > 100) throw new Error(`thresholds: ${mod}=${v} is above 100`);
    out[mod] = v;
  }
  return out;
}

export function parseMinScore(text) {
  const v = Number(String(text ?? '0').trim() || '0');
  if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`min-score must be a whole number from 0 to 100, not "${text}"`);
  return v;
}

/**
 * What failed: each score under its minimum. A module with no score (it could not be checked)
 * fails only when a minimum was set for it, and says why.
 */
export function evaluate(scores, minOverall, thresholds) {
  const failures = [];
  if (minOverall > 0) {
    if (scores?.overall == null) failures.push(`Overall has no score (the check did not finish), minimum ${minOverall}`);
    else if (scores.overall < minOverall) failures.push(`Overall ${scores.overall} is below ${minOverall}`);
  }
  for (const [mod, min] of Object.entries(thresholds)) {
    const v = scores?.[mod];
    if (v == null) failures.push(`${LABELS[mod]} has no score, minimum ${min}`);
    else if (v < min) failures.push(`${LABELS[mod]} ${v} is below ${min}`);
  }
  return failures;
}

/** The job summary: a table of every score, marked where a minimum applies. */
export function summary(report, minOverall, thresholds, failures) {
  const s = report.scores ?? {};
  const row = (key, min) => {
    const v = s[key];
    const mark = min === undefined || min === 0 ? '' : v != null && v >= min ? ' ✅' : ' ❌';
    return `| ${LABELS[key]} | ${v ?? '–'}${mark} | ${min ? min : ''} |`;
  };
  return [
    `### getReport: ${report.url}`,
    '',
    `Grade **${s.grade ?? '–'}** · [full report](${report.reportUrl})`,
    '',
    '| | Score | Minimum |',
    '| --- | --- | --- |',
    row('overall', minOverall),
    ...MODULES.map((m) => row(m, thresholds[m])),
    '',
    failures.length ? `**Failed:** ${failures.join('; ')}.` : 'All minimums met.',
    '',
  ].join('\n');
}

/**
 * Starts a check and waits for it. `fetchImpl` and `sleep` are injected for tests. Returns the
 * finished report view, with `reportUrl` added.
 */
export async function runCheck({ apiUrl, apiKey, url, device, fresh, timeoutMs, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now() }) {
  const base = apiUrl.replace(/\/+$/, '');
  const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'getreport-action/1' };
  const res = await fetchImpl(`${base}/api/v1/reports`, { method: 'POST', headers, body: JSON.stringify({ url, device, force: fresh }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`getReport refused the check (${res.status}): ${body.detail ?? body.title ?? 'no reason given'}`);
  const id = body.id;
  const deadline = now() + timeoutMs;
  for (;;) {
    const r = await fetchImpl(`${base}/api/v1/reports/${id}`, { headers });
    const view = await r.json().catch(() => ({}));
    if (r.ok && FINISHED.includes(view.status)) return { ...view, reportUrl: view.links?.html ?? `https://getreport.app/r/${id}` };
    if (now() > deadline) {
      const min = Math.round(timeoutMs / 60000);
      throw new Error(`The check did not finish within ${min} minute${min === 1 ? '' : 's'}: https://getreport.app/r/${id}`);
    }
    await sleep(5000);
  }
}
