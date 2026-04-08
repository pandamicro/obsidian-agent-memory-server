import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeHookEnvelope } from '../contracts.ts';

test('normalizeHookEnvelope maps hook event names to canonical envelope events', () => {
  const cases: Array<[Parameters<typeof normalizeHookEnvelope>[1], string]> = [
    ['SessionStart', 'session-start'],
    ['UserPromptSubmit', 'user-prompt-submit'],
    ['Stop', 'stop'],
    ['PreToolUse', 'pre-tool-use'],
    ['PostToolUse', 'post-tool-use'],
  ];

  for (const [eventName, expected] of cases) {
    const envelope = normalizeHookEnvelope({ session_id: 'session-1' }, eventName);
    assert.equal(envelope.event, expected);
    assert.equal(envelope.schema_version, '1');
    assert.equal(envelope.source, 'native');
    assert.equal(envelope.session_id, 'session-1');
  }
});

test('normalizeHookEnvelope emits derived metadata with confidence clamping', () => {
  const envelope = normalizeHookEnvelope(
    { session_id: 'session-2', turn_id: 'turn-2' },
    'PostToolUse',
    {
      source: 'derived',
      confidence: 1.5,
      parserReason: 'signal_rule_match',
      context: { signal: 'needs-input' },
    },
  );

  assert.equal(envelope.source, 'derived');
  assert.equal(envelope.confidence, 1);
  assert.equal(envelope.parser_reason, 'signal_rule_match');
  assert.equal(envelope.turn_id, 'turn-2');
  assert.deepEqual(envelope.context, { signal: 'needs-input' });
});

test('normalizeHookEnvelope preserves thread_id and turn_id when provided', () => {
  const envelope = normalizeHookEnvelope(
    { session_id: 'session-3', thread_id: 'thread-3', turn_id: 'turn-3' },
    'UserPromptSubmit',
  );

  assert.equal(envelope.session_id, 'session-3');
  assert.equal(envelope.thread_id, 'thread-3');
  assert.equal(envelope.turn_id, 'turn-3');
});
