# interactive.html Specification

## Design System

All interactive demos share a consistent dark-theme VS Code-inspired design.

### Colors
```
Background:    #1e1e1e (body/container)
Surface:       #252526 (panels, cards)
Border:        #333333 (dividers, outlines)
Text Primary:  #cccccc
Text Secondary:#858585
Title/Heading: #569cd6 (blue)
Success:       #22c55e / #6a9955 (green)
Warning:       #f59e0b (amber)
Error:         #f44747 (red)
Accent:        #8b5cf6 (purple)
Button:        #0e639c (hover: #1177bb)
Button Danger: #8b0000 (hover: #a00000)
Value/Data:    #dcdcaa (yellow)
```

### Typography
```css
font-family: 'Courier New', monospace;
font-size: 13px;     /* body text */
font-size: 16px;     /* h2 title */
font-size: 12px;     /* labels, controls */
font-size: 11px;     /* small text, legends */
```

### Layout
```css
html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; box-sizing: border-box; }
.container { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 12px; }
.panel { flex: 1; border: 1px solid #333; border-radius: 6px; padding: 12px; overflow-y: auto; }
```

### Components

**Button:**
```css
button {
  background: #0e639c;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
button:hover { background: #1177bb; }
button:disabled { background: #333; color: #777; cursor: not-allowed; }
```

**Panel:**
```css
.panel {
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  overflow-y: auto;
  font-size: 13px;
}
.panel-title {
  color: #569cd6;
  font-size: 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid #333;
  padding-bottom: 4px;
}
```

**Status indicators:**
```css
.status-ok   { background: #1a3c1a; border-left: 3px solid #22c55e; }
.status-fail { background: #3c1a1a; border-left: 3px solid #f44747; }
.status-wait { background: #2a2a1a; border-left: 3px solid #f59e0b; }
```

## Structure Template

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>演示标题</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#1e1e1e;color:#cccccc;font-family:'Courier New',monospace;overflow:hidden}
.container{display:flex;flex-direction:column;height:100%;padding:16px;gap:12px}
h2{color:#569cd6;font-size:16px}
/* ... more styles ... */
</style>
</head>
<body>
<div class="container">
  <div>
    <h2>演示标题</h2>
    <div class="controls">
      <button onclick="startDemo()">开始模拟</button>
      <button class="danger" onclick="resetAll()">重置</button>
      <span id="status" class="status">点击按钮开始</span>
    </div>
  </div>
  <div class="main">
    <!-- panels here -->
  </div>
</div>
<script>
// Demo logic here
</script>
</body>
</html>
```

## Interaction Patterns

### Pattern 1: Step-by-step simulation
User clicks a button, events appear one by one with animation.
Good for: streaming, retry attempts, loop iterations.

### Pattern 2: Side-by-side comparison
Two panels showing different approaches (serial vs parallel, with/without retry).
Good for: concurrency, optimization before/after.

### Pattern 3: Timeline visualization
Events plotted on a horizontal timeline with bars showing duration.
Good for: latency comparison, overlap visualization.

### Pattern 4: State machine
Nodes light up as state transitions happen.
Good for: Agent Loop lifecycle, degradation chain.

## Animation

```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.animated { animation: fadeIn 0.3s; }
```

Use `setTimeout` / `setInterval` for step-by-step reveals. Typical interval: 300-800ms per step.

## Required Elements

1. **Title** (h2, blue) — describes what this demo shows
2. **Controls** — at least one action button + reset button
3. **Status text** — shows current state in green
4. **Main content area** — flex panels with visual output
5. **No scrollbar on body** — content fits viewport

## Anti-Patterns

- White or light backgrounds (must be #1e1e1e)
- External dependencies (CDN scripts, Google Fonts)
- Sans-serif fonts (use Courier New / monospace)
- Alerts or confirm dialogs (use inline status text)
- Console-only output (must be visual)
- Static content with no interaction
