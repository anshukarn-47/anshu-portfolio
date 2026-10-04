# Arcade game rules

The reference for every game in the Arcade (`/arcade`). Each new game follows all ten rules. If a rule can't be met, raise it before building, not after.

## Where things live

| What | Where |
| --- | --- |
| Game list (slug, title, hook, mechanic, duration, work record, status) | `lib/arcade/registry.ts` |
| Game data (items, levels, documents), one file per game, or a folder for a larger game (Neural Maze uses `lib/arcade/neural-maze/`) | `lib/arcade/games/<slug>.ts` |
| Game play component and its tutorial, debrief text and scoring note | `components/arcade/games/<slug>.tsx` |
| Playable games by slug, each loaded on demand as its own bundle (add a loader line per game) | `components/arcade/games.ts` |
| Shared frame: phases, relaxed mode, pause, restart | `components/arcade/game-shell.tsx` |
| Fixed-timestep loop (pauses when the tab is hidden) | `components/arcade/use-game-loop.ts` |
| Debrief and real-world case | `components/arcade/debrief.tsx` |
| Real-world case loader (Supabase work record) | `lib/arcade/case-study.ts` |
| Analytics events | `lib/analytics/shared.ts`, sent with `trackEvent` from `components/analytics/tracker.tsx` |
| Tests for the rules and scoring (pure logic, no DOM), one file per game | `tests/arcade/<slug>.test.ts`, run with `npm test` |

## The rules

### 1. Structure

- Every game runs in `GameShell`: tutorial → play → debrief → real case.
- All items, levels and documents live in data files with fixed sequences.
- No randomness, so every run of the same choices gives the same result and testing is repeatable.

### 2. Input parity

- Every action works with keyboard, mouse and touch.
- No gesture-only controls: anything done by dragging or swiping also has a button or key.

### 3. Relaxed mode

- No timer, and slower or paused motion.
- Moving items pause on hover or focus.
- The shell's relaxed toggle is the switch; games read it from `relaxed` in `PlayProps`.

### 4. Respect prefers-reduced-motion

- Reduce movement: no travel, scaling or parallax.
- Never block play: anything that animates must still be playable, and finish, with motion reduced.

### 5. Tone

- Never "game over", "you lost" or "wrong".
- Show neutral consequences (what happened as a result) and move on.
- Never grade the person.

### 6. Scoring

- The score rewards decision quality, not speed or click count.
- The debrief states what the score rewards (`scoreRewards` in the game definition).

### 7. Content

- Fictional data only.
- Results are labelled "simulated".
- No real client, employer, system or confidential field names.
- The real-case section uses only facts from the linked work record (`relatedWorkSlug`), and no numbers that aren't in it.
- If no suitable work record exists, stop and ask instead of creating one.

### 8. Original names and visuals

- Names and visuals are original.
- Don't use the names or visual styles of existing games.

### 9. Implementation

- DOM or SVG, animated with CSS or Framer Motion. Use canvas only if frame rate suffers.
- Aim for a smooth 60fps on a mid-range phone.
- Pause when the tab is hidden (the shell and `useGameLoop` already do).
- Announce key events through `aria-live`.
- Sentence case throughout.
- Flight Deck tokens only (`bg-ink`, `bg-panel`, `border-rule`, `text-text`, `text-text-dim`, `signal-*` and so on), no new colours.

### 10. Analytics

- Through the existing utility, with the `arcade_` prefix.
- The shell already sends `arcade_game_start`, `arcade_game_complete`, `arcade_debrief_view` and `arcade_case_study_open`, with the game slug as the target.
- A new event name must be added to `TRACKED_EVENTS` in `lib/analytics/shared.ts`, or `/api/track` rejects it.

### 11. Tests

- Keep every game's rules and scoring in pure functions, with a test file in `tests/arcade/`.
- Test what the game claims: what the score rewards (good decisions beat filling, speed or volume), the fixed level and data invariants, and the effect of each mechanic.
- Run `npm test` before every push.
