#!/usr/bin/env node

/**
 * validate.mjs — Validates a running teaching-viz server.
 *
 * Usage: node validate.mjs --port <port>
 * Output: JSON to stdout with validation results
 *
 * Checks:
 *   1. GET /api/cases returns valid array
 *   2. Each case: knowledge.md accessible
 *   3. Each case with index.mjs: code execution succeeds (exit code 0)
 *   4. Each case with diagram.mmd: file accessible
 *   5. Each case with mindmap.md: file accessible
 *   6. Excalidraw overview: returns 200 or 404 (not 500)
 */

const args = process.argv.slice(2);
let port = 38888;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i], 10);
}

const BASE = `http://localhost:${port}`;

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, text: await res.text() };
}

async function validateRun(caseId) {
  try {
    const res = await fetch(`${BASE}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let exitCode = null;
    let hasOutput = false;
    const timeout = Date.now() + 15000; // 15s max per case

    while (Date.now() < timeout) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'stdout' || event.type === 'stderr') hasOutput = true;
          if (event.type === 'exit') {
            exitCode = JSON.parse(event.data).code;
          }
        } catch {}
      }

      if (exitCode !== null) break;

      // Small delay to avoid busy-waiting
      await new Promise(r => setTimeout(r, 50));
    }

    return { exitCode, hasOutput, timedOut: exitCode === null };
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const results = {
    port,
    checks: { cases: null, knowledge: [], execution: [], diagram: [], mindmap: [], excalidraw: null },
    passed: 0,
    failed: 0,
    errors: [],
  };

  // 1. Case list
  try {
    const { status, data } = await fetchJSON('/api/cases');
    if (status !== 200 || !Array.isArray(data)) {
      results.errors.push(`GET /api/cases: expected 200 with array, got ${status}`);
      results.failed++;
    } else {
      results.checks.cases = { count: data.length, status: 'ok' };
      results.passed++;

      // 2. Validate each case
      for (const c of data) {
        // Knowledge
        const k = await fetchText(`/api/file/cases/${c.id}/knowledge.md`);
        if (k.status === 200 && k.text.length > 0) {
          results.checks.knowledge.push({ id: c.id, status: 'ok' });
          results.passed++;
        } else {
          results.checks.knowledge.push({ id: c.id, status: 'fail', detail: `HTTP ${k.status}` });
          results.failed++;
        }

        // Diagram
        if (c.content?.diagram) {
          const d = await fetchText(`/api/file/cases/${c.id}/diagram.mmd`);
          if (d.status === 200 && d.text.length > 0) {
            results.checks.diagram.push({ id: c.id, status: 'ok' });
            results.passed++;
          } else {
            results.checks.diagram.push({ id: c.id, status: 'fail', detail: `HTTP ${d.status}` });
            results.failed++;
          }
        }

        // Mindmap
        if (c.content?.mindmap) {
          const m = await fetchText(`/api/file/cases/${c.id}/mindmap.md`);
          if (m.status === 200 && m.text.length > 0) {
            results.checks.mindmap.push({ id: c.id, status: 'ok' });
            results.passed++;
          } else {
            results.checks.mindmap.push({ id: c.id, status: 'fail', detail: `HTTP ${m.status}` });
            results.failed++;
          }
        }

        // Execution
        if (c.files && c.files.includes('index.mjs')) {
          const exec = await validateRun(c.id);
          if (exec.error) {
            results.checks.execution.push({ id: c.id, status: 'error', detail: exec.error });
            results.failed++;
          } else if (exec.exitCode === 0) {
            results.checks.execution.push({ id: c.id, status: 'ok', hasOutput: exec.hasOutput });
            results.passed++;
          } else {
            results.checks.execution.push({ id: c.id, status: 'fail', exitCode: exec.exitCode, timedOut: exec.timedOut });
            results.failed++;
          }
        }
      }
    }
  } catch (err) {
    results.errors.push(`Fatal: ${err.message}`);
    results.failed++;
  }

  // 3. Excalidraw overview
  try {
    const { status } = await fetchJSON('/api/excalidraw/overview');
    if (status === 200 || status === 404) {
      results.checks.excalidraw = { status: status === 200 ? 'ok' : 'no-overview' };
      results.passed++;
    } else {
      results.checks.excalidraw = { status: 'fail', detail: `HTTP ${status}` };
      results.failed++;
    }
  } catch (err) {
    results.checks.excalidraw = { status: 'error', detail: err.message };
    results.failed++;
  }

  results.allPassed = results.failed === 0 && results.errors.length === 0;
  console.log(JSON.stringify(results, null, 2));
}

main();
