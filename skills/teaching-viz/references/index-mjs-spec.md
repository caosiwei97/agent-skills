# index.mjs Specification

## Runtime Environment

- WebContainer (browser-based Node.js sandbox)
- Available packages: `ai` (Vercel AI SDK v4), `zod`
- Available local modules: `../lib/mock-model.mjs`, `../lib/mock-tools.mjs`, `../lib/utils.mjs`, `../lib/retry.mjs`, `../lib/loop-detection.mjs`
- Node.js built-ins: `node:crypto` (for fingerprinting)

## CORE PRINCIPLE: Unified Skeleton

ALL cases share the SAME `while(true)` agent-loop skeleton. Each case adds exactly ONE new feature to the previous case. A reader who understood case N should only need to read the ONE new block in case N+1.

Mark new additions with:
```javascript
// ═══ 本案例新增 ═══
// <feature code>
// ══════════════════
```

## Base Skeleton (case-03 onwards)

```javascript
/**
 * @title <中文标题>
 * @group <流式响应|容错机制|运行时安全>
 * @description <一句话描述>
 */
import { createMultiTurnModel } from '../lib/mock-model.mjs';
import { streamText } from 'ai';
import { allTools } from '../lib/mock-tools.mjs';

// ═══ 本案例新增 ═══
function newFeature() { /* ... */ }
// ══════════════════

const model = createMultiTurnModel([ /* per-case scenarios */ ]);

async function agentLoop() {
  const messages = [{ role: 'user', content: '...' }];
  let step = 0;
  const MAX_STEPS = 5;

  console.log('[用户]', messages[0].content);

  while (true) {
    step++;
    console.log(`\n── 第 ${step} 轮 ──`);

    // 1. 调用模型 (流式)
    const result = streamText({ model, messages, tools: allTools, maxSteps: 1 });

    // 2. 消费流
    let text = '';
    let hasToolCall = false;
    for await (const event of result.fullStream) {
      if (event.type === 'text-delta') {
        text += event.textDelta;
        process.stdout.write(event.textDelta);
      } else if (event.type === 'tool-call') {
        hasToolCall = true;
        console.log(`\n  [工具调用] ${event.toolName}(${JSON.stringify(event.args)})`);
      } else if (event.type === 'tool-result') {
        console.log(`  [工具结果] ${event.toolName} → ${String(event.result).slice(0, 60)}...`);
      }
    }

    // 3. 退出判断
    if (!hasToolCall) { console.log('\n[退出] 模型完成'); break; }
    if (step >= MAX_STEPS) { console.log('\n[退出] 达到最大轮次'); break; }

    // 4. 组装下轮 messages
    const response = await result.response;
    messages.push(...response.messages);
  }

  console.log(`\n[完成] 共 ${step} 轮`);
}

agentLoop().catch(console.error);
```

## Progressive Case Structure

| Case | Builds On | New Addition |
|------|-----------|-------------|
| 01 | — | Streaming only (no tools, no loop) |
| 02 | 01 | +tools, +tool-call handling |
| 03 | 02 | +while(true) loop, +multi-turn |
| 04 | 03 | +classifyConcurrency() |
| 05 | 03 | +retryWithBackoff() |
| 06 | 03 | +watchdog() |
| 07 | 05 | +degradeOnFailure() 3 layers |
| 08 | 03 | +detectLoop() fingerprint |
| 09 | 03 | +checkBudget() |
| 10 | 03 | +truncation recovery |
| 11 | 03 | +7 exit conditions |
| 12 | 03 | +ALL defenses combined |

## Mock Model API

### createMockModel(chunks, opts)
Single-response model.
```javascript
const model = createMockModel([
  { type: 'text-delta', textDelta: '你好' },
  { type: 'finish', finishReason: 'stop', usage: { promptTokens: 5, completionTokens: 10 } },
], { chunkDelay: 100 });
```

### createMultiTurnModel(scenarios)
Multi-turn model (different response per call).
```javascript
const model = createMultiTurnModel([
  // Turn 1: text + tool call
  [
    { type: 'text-delta', textDelta: '让我看看...' },
    { type: 'tool-call', toolCallType: 'function', toolCallId: 'c1', toolName: 'read_file', args: '{"path":"src/utils.ts"}' },
    { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 5, completionTokens: 20 } },
  ],
  // Turn 2: final answer
  [
    { type: 'text-delta', textDelta: '分析完成，问题在...' },
    { type: 'finish', finishReason: 'stop', usage: { promptTokens: 50, completionTokens: 30 } },
  ],
]);
```

### createFailingModel(opts)
Fails N times then succeeds (for retry demos).
```javascript
const model = createFailingModel({ failCount: 3, error: new Error('429 Too Many Requests') });
```

### createTruncatingModel(opts)
Truncates N times (finishReason='length') then completes.
```javascript
const model = createTruncatingModel({ truncateCount: 2 });
```

## Available Tools (from mock-tools.mjs)

```javascript
import { allTools } from '../lib/mock-tools.mjs';
// allTools = { get_weather, calculator, read_file, write_file, grep_files, run_bash }
```

## Console Output Prefixes

| Prefix | Usage |
|--------|-------|
| `[用户]` | User input |
| `── 第 N 轮 ──` | Loop iteration start |
| `[工具调用]` | Tool call detected |
| `[工具结果]` | Tool result received |
| `[退出]` | Loop exit with reason |
| `[完成]` | Summary after loop |
| `[新增]` | Explain the new feature being demonstrated |

## Constraints

- 80-200 lines per file
- NEVER call real APIs
- Only import from: `ai`, `zod`, `../lib/*.mjs`, `node:crypto`
- Wrap in `async function agentLoop() { ... } agentLoop().catch(console.error);`
- Each case's diff from the previous case should be < 30 lines of new code
