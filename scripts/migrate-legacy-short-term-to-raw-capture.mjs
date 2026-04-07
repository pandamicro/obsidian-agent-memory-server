#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'agents';
const dryRun = process.argv.includes('--dry-run');

function isLegacyShortTerm(doc) {
  return doc
    && doc.object_kind === 'episode'
    && doc.event_type === 'captured'
    && typeof doc.input === 'string'
    && !doc.source_message_id;
}

function toRawCapture(doc) {
  const messageId = String(doc.message_id ?? '').trim();
  const observedAt = String(doc.observed_at ?? '').trim() || new Date().toISOString();
  return {
    schema_version: '1',
    message_id: messageId,
    identity_id: String(doc.identity_id ?? '').trim(),
    object_kind: 'raw_capture',
    object_ref: `raw-capture:${messageId}`,
    event_type: 'captured',
    evidence_refs: Array.isArray(doc.evidence_refs) ? doc.evidence_refs : [],
    observed_at: observedAt,
    source_kind: 'direct_input',
    session_id: null,
    workspace_root: null,
    assistant_summary: null,
    candidates: [],
    input: String(doc.input ?? ''),
  };
}

async function main() {
  const agents = await readdir(root, { withFileTypes: true });
  const report = [];

  for (const entry of agents) {
    if (!entry.isDirectory()) continue;
    const agentId = entry.name;
    const shortTermDir = join(root, agentId, 'memory', 'short-term');
    const rawCaptureDir = join(root, agentId, 'memory', 'raw-capture');

    if (!existsSync(shortTermDir)) continue;

    const files = (await readdir(shortTermDir)).filter((name) => name.endsWith('.json')).sort();
    let converted = 0;
    let skipped = 0;

    if (!dryRun) {
      await mkdir(rawCaptureDir, { recursive: true });
    }

    for (const file of files) {
      const shortTermPath = join(shortTermDir, file);
      const rawCapturePath = join(rawCaptureDir, file);
      const parsed = JSON.parse(await readFile(shortTermPath, 'utf8'));

      if (!isLegacyShortTerm(parsed)) {
        skipped += 1;
        continue;
      }

      if (!parsed.message_id || !parsed.identity_id) {
        skipped += 1;
        continue;
      }

      if (existsSync(rawCapturePath)) {
        skipped += 1;
        continue;
      }

      const raw = toRawCapture(parsed);
      if (!dryRun) {
        await writeFile(rawCapturePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
      }
      converted += 1;
    }

    if (converted > 0 || skipped > 0) {
      report.push({ agentId, converted, skipped });
    }
  }

  console.log(JSON.stringify({ root, dryRun, report }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
