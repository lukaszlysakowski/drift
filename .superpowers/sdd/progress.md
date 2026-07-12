# Drift — SDD Progress Ledger

## Timeout-resilience protocol (binding)
- Implementers: commit incrementally after each step; create task-N-report.md at task START and update as you go.
- Controller: a tiny result or "session limit" text = limit-killed subagent. Do NOT re-dispatch until reset; salvage from git + working tree first.
- Fallback: CONTROLLER INLINE with explicit ledger attribution.
- Final review: fresh independent subagent (most capable model), zero deference to inline work.

## Task log
Task 1: complete (commits 32855bf..44eed77, verify 6/6, review clean incl browser load; canvas-container id correct, CSS byte-identical to Interference, renderAll index-based). NOTE: brief prose note still mentions indexOf (stale from plan edit) — code is correctly index-based; harmless. Launch config drift:3464 added by controller.
Task 2: complete (commits a0805f6..68ab3f2, verify 4/4, review clean; verbatim). Divergence-free foundation verified: baseField = curl of scalar potential, tested pre-normalization at <2% relative divergence — confirms all pooling is from feedback not field artifact.
Task 3: complete (commits 2c59fdf..8e9e008, verify 5/5, review clean after fix). PLAN BUG (mine) caught + fixed: implementer initially made depSmooth 10 passes to satisfy a gradient test that sampled ~7.5 cells from the pile; reviewer confirmed root cause was the mis-located test probe, not the smoothing. FIX: reverted depSmooth to spec-faithful SINGLE [1,2,1]/4 pass; moved test probe to 1190,1000 (~1.5 cells, gx=0.061). depSmooth is now single-pass per spec ('light 3-tap blur, not single-cell aliasing').
