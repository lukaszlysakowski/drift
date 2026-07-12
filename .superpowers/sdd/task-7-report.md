# Task 7: Export — SVG pen passes + PNG

**Status:** In progress

## Implementation Plan
- [x] Replace exportSVG/exportPNG stubs with implementations from brief
- [x] Add helper functions: polyToPath, svgPass, buildSVG
- [x] Create and run verify script (expect 12 passed, 0 failed)
- [x] Commit incrementally

## Progress Log

### Step 1: Add helper functions and export implementations
✓ Implemented all three helpers and export functions per task-7-brief.md
  - polyToPath: converts path points to SVG M/L path data with wobble
  - svgPass: wraps path group in SVG layer with inkscape metadata
  - buildSVG: assembles 5-pass SVG (Border, Streaks-light, Streaks-heavy, Channel, Signature)

### Step 2: Verify implementation
✓ Created task-7-verify.js from task-1-verify.js boilerplate
✓ Ran verification on seed 4242

## Verification Results
```
  ok  pass present: Border
  ok  pass present: Streaks-light
  ok  pass present: Streaks-heavy
  ok  pass present: Channel
  ok  pass present: Signature
  ok  exactly 5 layer groups
  ok  red only in Channel
  ok  Channel has exactly one path
  ok  paths exist
  ok  M/L-only paths
  ok  viewBox correct
  ok  signature in svg
  ok  wobble deterministic across builds
  ok  wobble changes geometry

14 passed, 0 failed
```

## Commits
- `bddbf50` Task 7: SVG pen passes + PNG/PNG-4x export
  - Added polyToPath, svgPass, buildSVG helper functions
  - Replaced exportSVG/exportPNG stubs with full implementations
  - Created and verified task-7-verify.js (14/14 checks pass)
