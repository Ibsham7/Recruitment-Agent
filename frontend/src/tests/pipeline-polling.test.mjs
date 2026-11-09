import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real hook with React Query replaced by a settings collector.
const source = readFileSync(new URL('../lib/hooks/usePipeline.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let settings;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: (name) => {
    if (name === 'react') return { useCallback: (fn) => fn };
    if (name === '@tanstack/react-query') return {
      useQuery: (options) => { settings = options; return {}; },
      useQueryClient: () => ({ invalidateQueries() {} }),
    };
    if (name === '../api') return { apiFetch() { throw new Error('Unexpected network call'); } };
    throw new Error(`Unexpected import: ${name}`);
  },
});
exports.usePipeline('demo');

test('poll only while actual candidate status requires processing', () => {
  for (const status of ['pending', 'screening']) {
    assert.equal(settings.refetchInterval({ state: { data: { candidates: [{ status, stage: 'screening' }] } } }), 3000);
  }
  for (const status of ['screening_hold', 'shortlisted', 'interview_completed', 'rejected', 'complete']) {
    assert.equal(settings.refetchInterval({ state: { data: { candidates: [{ status, stage: 'screening' }] } } }), false);
  }
  assert.equal(settings.refetchInterval({ state: { data: { candidates: [] } } }), false);
});
