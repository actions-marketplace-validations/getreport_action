/**
 * getReport GitHub Action entry point (ADR 0046): reads the inputs GitHub passes as INPUT_*
 * variables, runs the check, writes outputs and a job summary, and fails the step when a score
 * is under its minimum. No dependencies, so the file runs as it is on node20.
 */
import { appendFileSync } from 'node:fs';
import { evaluate, parseMinScore, parseThresholds, runCheck, summary } from './logic.mjs';

/** GitHub reads workflow commands (::error::, ::add-mask::) from stdout. */
const out = (line) => process.stdout.write(`${line}\n`);
const input = (name) => (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const url = input('url');
  const apiKey = input('api-key');
  if (!url) throw new Error('url is required');
  if (!apiKey) throw new Error('api-key is required: get a free key at https://getreport.app/api and store it as a secret');
  out(`::add-mask::${apiKey}`);
  const minOverall = parseMinScore(input('min-score') || '0');
  const thresholds = parseThresholds(input('thresholds'));
  const device = input('device') === 'desktop' ? 'desktop' : 'mobile';
  const report = await runCheck({
    apiUrl: input('api-url') || 'https://api.getreport.app',
    apiKey,
    url,
    device,
    fresh: input('fresh') !== 'false',
    timeoutMs: Math.max(1, Number(input('timeout-minutes') || '8')) * 60_000,
  });
  const failures = report.status === 'failed' ? [`the check failed: ${report.error ?? 'the page could not be fetched'}`] : evaluate(report.scores, minOverall, thresholds);
  setOutput('report-url', report.reportUrl);
  setOutput('report-id', report.id);
  setOutput('overall', report.scores?.overall ?? '');
  setOutput('grade', report.scores?.grade ?? '');
  setOutput('scores', JSON.stringify(report.scores ?? {}));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(report, minOverall, thresholds, failures));
  out(`getReport: ${report.url} → grade ${report.scores?.grade ?? '–'}, overall ${report.scores?.overall ?? '–'} · ${report.reportUrl}`);
  if (failures.length) {
    for (const f of failures) out(`::error title=getReport::${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  out(`::error title=getReport::${e.message}`);
  process.exitCode = 1;
});
