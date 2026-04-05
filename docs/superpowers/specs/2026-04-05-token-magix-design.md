# Token Magix — Design Spec

## Overview

Two features that surface tag/status information on tokens in the canvas:

1. **Token HUD Status Panel** — A custom TokenHUD subclass that shows statuses from the compendium pack, with tier checkboxes on active statuses.
2. **Hover Tooltip** — A DOM overlay that appears on token hover showing active story tags and status tags with system badge styling.

## Feature 1: Token HUD Status Panel

### Architecture

`LitmTokenHUD` extends Foundry's `TokenHUD`. Registered via `CONFIG.Token.hudClass = LitmTokenHUD` during `init`.

### Compendium Integration

- **On `ready` hook:** Load the full `statuses` compendium pack and populate `CONFIG.statusEffects` from it. Each entry maps to: `{ id, name, img }`.
- **On HUD render (in `_prepareContext` or `_getStatusEffectChoices`):** Diff the compendium pack index against `CONFIG.statusEffects`. If the index has changed (entries added, removed, or renamed), rebuild `CONFIG.statusEffects` before rendering the menu.
- The full compendium load happens once. The index diff is the cheap recurring check.

### Status Effect Choices

Override `_getStatusEffectChoices()` to enrich the data for active statuses:
- Inactive statuses: icon + name (same as Foundry default).
- Active statuses: icon + name + tier data (`system.tiers`, `currentTier` from `StatusTagData`).

### Custom Template

Replace the status palette rendering with a custom template part (`templates/hud/token-hud-status.html`):
- Inactive statuses render as simple icons (clickable to add).
- Active statuses render with the status name and 6 tier checkboxes inline, matching the tier UI used on actor sheets.

### Interaction

- **Click a tier box:** Marks that specific tier on the status effect (uses `StatusTagData.calculateMark()`).
- **Left-click status icon/name (inactive):** Creates a `status_tag` ActiveEffect at tier 1 via `statusTagEffect()` from utils.js.
- **Left-click status icon/name (active, all tiers unchecked):** Removes the effect.
- **Right-click status icon/name (active):** Removes the effect entirely.

### Effect Lifecycle

Override `_onToggleEffect` to create proper `status_tag` typed ActiveEffects rather than Foundry's generic status toggle. Uses `statusTagEffect()` factory from utils.js for creation.

## Feature 2: Hover Tooltip

### Trigger

Listen to `hoverToken` hook (fires with `(token, hovered)`).

### Content

Query from the token's actor:
- `actor.system.statusEffects` — status tags (from EffectTagsMixin)
- `actor.system.storyTags` — story tags (from EffectTagsMixin)

Render each as styled badges:
- Status tags: `litm-status` class with tier number suffix (e.g., "wounded 3")
- Story tags: `litm-tag` class

Both use the `data-text` attribute for the pseudo-element text stroke, matching `play-tag.html` pattern.

### Visibility

Filter by `isHidden` flag on each effect:
- Hidden tags/statuses only shown if `game.user.isGM` or `token.actor.isOwner`.
- If no visible tags/statuses exist, no tooltip is rendered.

### Positioning

Anchor to the token's screen position via `token.worldTransform` + canvas zoom. Placed above the token, centered horizontally.

### Cleanup

Remove the tooltip element on:
- Token unhover
- Canvas pan
- Token deletion

## File Structure

### New Files

- `scripts/hud/litm-token-hud.js` — `LitmTokenHUD` subclass with compendium integration, custom status choices, and tier interaction.
- `scripts/hud/token-tooltip.js` — Hover tooltip: build/position/remove DOM overlay with tag/status badges.
- `templates/hud/token-hud-status.html` — Custom Handlebars template for the status palette (icons + tier boxes for active statuses).

### Modified Files

- `litmv2.js` — Add `CONFIG.Token.hudClass = LitmTokenHUD` in init hook.
- `scripts/system/hooks/index.js` — Import and call `registerTokenHooks()`.
- `scripts/system/hooks/token-hooks.js` (new) — Register `ready` compendium load and `hoverToken` tooltip listener.

### No Changes Required

- Existing actor sheets, data models, CSS (litm-tag/litm-status styling already exists), or utils.js.

## Compendium Pack

The `statuses` pack (renamed from `status-effects`) contains 23 curated statuses sourced from the Action Grimoire and Core Book:

**Physical harm:** wounded, poisoned, burned, stunned, paralyzed, crushed
**Fatigue & needs:** exhausted, hungry
**Mental & emotional:** scared, confused
**Social:** convinced, intimidated, humiliated
**Positional:** prone, exposed, surprised
**Magical:** drained, cursed, warded
**Beneficial:** alert, hidden, inspired, invigorated

Build script: `node scripts/system/build-packs.js` generates source JSON, then `fvtt package pack statuses` compiles to LevelDB.
