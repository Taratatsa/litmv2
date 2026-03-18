# Limit-Grouped Statuses in the Story Tag Sidebar

**Date:** 2026-03-18
**Status:** Draft

## Problem

Challenge limits and status cards are independent systems. GMs manually track limit progress with +/- buttons on the challenge sheet, while statuses accumulate separately in the story tag sidebar. There is no way to link statuses to limits or have limits auto-calculate from the statuses they represent. This creates bookkeeping overhead during play.

## Solution

Allow GMs to group statuses under limits in the story tag sidebar. Limit values auto-calculate from the grouped statuses using the game's tier stacking mechanic. The feature is GM-only — players see statuses in a flat list with no limit headers.

## Requirements

1. **Challenge limits auto-appear** in the sidebar when a challenge actor is present, sourced from `system.limits[]`.
2. **Story-level limits** can be added via a shield button in the story tags toolbar. These are lightweight (label + max only, no outcome).
3. **Drag-and-drop assignment** — GM drags a status onto a limit header to group it; drags it out to ungroup.
4. **1:1 assignment** — each status belongs to at most one limit.
5. **Auto-calculated value** — limit value is computed by stacking all grouped statuses' tier arrays using the `calculateMark` box-by-box mechanic.
6. **Write-back** — computed challenge limit values are persisted to `system.limits[].value` so the challenge sheet stays in sync.
7. **GM-only visibility** — players see all statuses in a flat list; limit group headers are not rendered for non-GM users.
8. **Limit-reached notification** — when a limit's computed value meets or exceeds its max, a private GM whisper chat message is created, following the existing track-completion chat card pattern (`litm-track-complete`). Only fires on the value transition (was below, now meets/exceeds).
9. **Ungrouped statuses** do not contribute to any limit.

## Stacking Algorithm

The stacking calculation merges multiple status tier arrays (6-element boolean arrays) onto a cumulative card. Each marked box is applied individually: if the target slot is empty, mark it; if occupied, bump to the next empty slot. Statuses are applied in their current sort order (the `sort` field on the ActiveEffect, or array position for story tags).

Example: Burned `[T,F,T,F,F,F]` + Shaken `[F,T,F,F,F,F]` + Cornered `[T,F,F,F,F,F]`

1. Start with `[F,F,F,F,F,F]`
2. Apply Burned's marked boxes (slots 1, 3): `[T,F,T,F,F,F]`
3. Apply Shaken's marked box (slot 2): slot 2 is empty → `[T,T,T,F,F,F]`
4. Apply Cornered's marked box (slot 1): slot 1 is occupied → bump to slot 4 → `[T,T,T,T,F,F]`
5. Result: tier 4

This reuses `StatusCardData.calculateMark`'s core logic, extracted as a static method.

## Data Model Changes

### `StatusCardData` (active-effect-data.js)

Add field:
```js
limitId: new fields.StringField({ initial: null, nullable: true })
```

References a stable `id` on the parent challenge actor's limit object, or a story-level limit's `id`. Using a string ID rather than an array index avoids breakage when limits are reordered, inserted, or deleted. `null` means ungrouped.

Extract `calculateMark` core logic into a static method and add a stacking utility:
```js
static markTier(tiers, tier) { /* core logic from calculateMark */ }
static stackTiers(tierArrays) { /* iterates marked boxes, delegates to markTier */ }
```

The instance method `calculateMark` delegates to `StatusCardData.markTier(this.tiers, tier)`.

### `StoryTagData` (active-effect-data.js)

Add the same field:
```js
limitId: new fields.StringField({ initial: null, nullable: true })
```

Story tags under a limit are decorative only — they appear nested under the limit header for organizational purposes but do not contribute to the stacking calculation (they have no tier arrays). Only status cards contribute to the computed limit value.

### `ChallengeData` (challenge-data.js)

Add a stable `id` field to each limit in the `limits` array schema:
```js
limits: new fields.ArrayField(
    new fields.SchemaField({
        id: new fields.StringField({ initial: () => foundry.utils.randomID() }),
        label: new fields.StringField({ initial: "" }),
        outcome: new fields.StringField({ initial: "" }),
        max: new fields.StringField({ initial: "3" }),
        value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
    }),
),
```

The `id` field provides a stable reference that survives reordering, insertion, and deletion. Existing limits without an `id` are handled defensively: `prepareDerivedData` assigns a `randomID()` to any limit missing one.

### `litmv2.storytags` world setting

Extend the shape from:
```js
{ tags: [], actors: [], hiddenActors: [] }
```
to:
```js
{ tags: [], actors: [], hiddenActors: [], limits: [] }
```

Each story-level limit:
```js
{ id: string, label: string, max: string, value: number }
```

No `outcome` field — story limits are ephemeral scene-level tools.

Story tag objects in `tags[]` gain a `limitId` property (nullable string) referencing a limit's `id`.

The `config` getter in `StoryTagSidebar` already defaults missing keys; `limits` is added to the default: `{ actors: [], tags: [], limits: [] }`.

## Sidebar Changes (story-tag-sidebar.js)

### Context Preparation

In `_prepareContext`, for each challenge actor:
1. Read `system.limits` from the actor document
2. Partition effects by `limitId`: grouped effects go under their matching limit, `null` goes to ungrouped
3. For each limit group, call `StatusCardData.stackTiers()` on the grouped status tier arrays (status cards only; story tags in the group are ignored for calculation)
4. For GM users: include limit groups with nested tags and the computed value
5. For non-GM users: flatten all effects into one list, ignore `limitId`

Same logic for the story section using the `litmv2.storytags` setting's `limits[]` and tag objects' `limitId`.

### Drag-and-Drop

Extend `_onDrop` to detect drops on limit headers (`[data-limit-id]`):
- Drop on a limit header → set `limitId` on the status effect/tag object
- Drop on the ungrouped area → set `limitId` to `null`

For actor effects: `actor.updateEmbeddedDocuments("ActiveEffect", [{ _id, "system.limitId": id }])`
For story tags: update the tag's `limitId` in the setting object.

**Cross-actor drags:** When a status is dragged from one actor to another, `limitId` is cleared (set to `null`) on the new effect. A `limitId` from Challenge A has no meaning on Challenge B.

### Story Limit CRUD

New actions:
- `add-limit` — appends `{ id: randomID(), label: "New Limit", max: "3", value: 0 }` to `limits[]` in the setting
- `remove-limit` — removes the limit and sets `limitId: null` on any story tags that referenced it

Limit label and max are editable inline inputs in the limit header, following the same change→submit pattern as tag names.

### Form Data Round-Tripping

The template includes a hidden input for `limitId` on each tag item:
```html
<input type="hidden" name="{{source}}.{{tag.id}}.limitId" value="{{tag.limitId}}" />
```

This ensures `onSubmit` preserves the `limitId` when reconstructing tag objects from form data, including when non-GM players submit changes to story tags.

### Challenge Limit Write-Back

When status effects are created, updated, or deleted on a challenge actor, recalculate all limit values and persist via `actor.update({ "system.limits": updatedLimits })`. This integrates into the existing `onSubmit`, `#addTagToActor`, and `#removeTagFromActor` flows.

Before writing back, compare old values to new values. For impossible limits (`max === "~"`), skip the transition check entirely. For numeric limits, if any limit transitions from below-max to at-or-above-max (`oldValue < numericMax && newValue >= numericMax`), fire the limit-reached chat message.

### Interaction with Challenge Sheet +/- Buttons

When a challenge limit has one or more statuses grouped under it in the sidebar, the sidebar's computed value is authoritative. The challenge sheet's manual +/- buttons (`increaseLimit`/`decreaseLimit` actions) are disabled for that limit. Limits with no grouped statuses retain their manual +/- controls.

This is determined at render time: if any effect on the actor has `system.limitId` matching the limit's `id`, the limit is "auto-managed" and +/- buttons are hidden or disabled.

## Template Changes (story-tags.html)

### New `limitGroup` inline partial

Renders a limit group header with nested tag items:
- Shield icon, editable label input, computed `value/max` display
- For challenge limits: info icon with outcome tooltip
- Nested `<ul>` of tag items (reuses existing `tagItem` partial)
- Empty state: italic "Drop statuses here..." placeholder
- Only rendered for GM users

### Story section toolbar

Add a shield button (`data-action="add-limit"`) alongside the existing tag and status buttons.

### Conditional rendering

Template checks `isGM`:
- **GM**: renders limit group headers with nested statuses, then ungrouped items below
- **Player**: renders all items in a flat `<ul>` as today

## CSS Changes (litmv2.css)

### `.litm--limit-group`

- Left border accent using `--color-litm-limit`
- Subtle background tint (`rgba` of the limit color)
- Border-radius on the right side
- Indented children (left padding on nested tag items)

### `.litm--limit-header`

- Flex row: shield icon, label input, value/max, optional info icon
- Smaller font size than actor headers
- Serves as a drop target (highlight on dragover)

### `.litm-track-complete--limit`

- New type for the track-completion chat card
- Header accent color: a warm earth tone fitting the limit/shield theme (similar to `--color-litm-limit`)
- Icon: `fa-shield`

### Dark mode

Matching overrides in the dark-mode section following the existing pattern for other track-complete types.

## Chat Message (limit-reached notification)

Reuses the `litm-track-complete` chat card pattern. To enable this:

1. Extract `buildTrackCompleteContent`, `TRACK_ICONS`, and `TRACK_LABEL_KEYS` from `hero-sheet.js` into a shared module at `scripts/system/chat.js`.
2. Add `limit` type with icon `fa-shield` and label key `LITM.Ui.track_complete_limit`.
3. The message body includes the limit label and, for challenge limits, the outcome text.
4. Created as a GM whisper: `foundry.documents.ChatMessage.create({ ..., whisper: foundry.documents.ChatMessage.getWhisperRecipients("GM") })`.
5. Only fires on the transition: skip if `max === "~"`; otherwise, `oldValue < numericMax && newValue >= numericMax`.

Example content for a challenge limit:
> **Limit Reached**
> **Driven Off** (Shadow Drake): *The drake retreats to its lair*

Example for a story limit:
> **Limit Reached**
> **Ritual Disrupted**

## Localization Keys

Add to `lang/en.json` and all other language files. Run `node check-keys.js` after adding keys to verify completeness across all `lang/*.json` files.

```json
{
  "LITM.Ui.add_limit": "Add Limit",
  "LITM.Ui.remove_limit": "Remove Limit",
  "LITM.Ui.limit_reached": "{label}",
  "LITM.Ui.limit_reached_with_outcome": "{label} ({actor}): {outcome}",
  "LITM.Ui.track_complete_limit": "Limit Reached",
  "LITM.Ui.drop_statuses_here": "Drop statuses here...",
  "LITM.Terms.limit_group": "Limit Group"
}
```

## Files Modified

| File | Change |
|---|---|
| `scripts/data/active-effect-data.js` | `limitId` field on both data models. Static `markTier()` and `stackTiers()` on `StatusCardData`. |
| `scripts/actor/challenge/challenge-data.js` | Add `id` field to limit schema entries. Defensive `prepareDerivedData` assigns IDs to legacy limits missing one. |
| `scripts/actor/challenge/challenge-sheet.js` | Disable +/- buttons for limits that have grouped statuses (auto-managed). |
| `scripts/apps/story-tag-sidebar.js` | Grouping logic in `_prepareContext`. Limit CRUD actions. Extended drag-drop (including clearing `limitId` on cross-actor moves). Challenge write-back. Limit-reached detection and chat. Form data round-tripping for `limitId`. |
| `templates/apps/story-tags.html` | `limitGroup` inline partial. Shield button in story toolbar. Hidden `limitId` input on tag items. GM/player conditional rendering. |
| `templates/actor/challenge-play.html` | Conditionally disable +/- buttons when limit is auto-managed. |
| `litmv2.css` | `.litm--limit-group`, `.litm--limit-header` styles. `.litm-track-complete--limit` chat card type. Dark mode overrides. |
| `scripts/actor/hero/hero-sheet.js` | Extract `buildTrackCompleteContent` and constants to shared module. Import from new location. |
| `scripts/actor/fellowship/fellowship-sheet.js` | Import `buildTrackCompleteContent` from shared module (has a duplicate copy today). |
| `scripts/system/chat.js` (new) | Shared chat card builder with track-complete types including `limit`. |
| `lang/en.json` (+ all other `lang/*.json`) | New localization keys. |

## Files Not Modified

- `roll-dialog.js` — statuses contribute individually to rolls regardless of grouping
- `sockets.js` — existing `storyTagsUpdate`/`storyTagsRender` events handle the new data

## Edge Cases

- **Legacy limits without `id`**: `ChallengeData.prepareDerivedData()` assigns a `randomID()` to any limit missing an `id` field, ensuring backward compatibility with existing worlds.
- **Limit deleted on challenge sheet**: When a limit is removed from `system.limits[]`, any effects with a `limitId` referencing it become orphaned. On the next sidebar render, orphaned `limitId` values (those not matching any current limit) are treated as ungrouped and rendered in the flat list. Optionally, a cleanup pass can null out orphaned `limitId` values.
- **Setting migration**: The `config` getter defaults `limits` to `[]` when the key is missing, so existing worlds work without migration.
- **Cross-actor drag**: `limitId` is cleared when a status moves between actors.
- **Impossible limits (`max: "~"`)**: These render in the sidebar with the `~` indicator. The stacking value is still computed and displayed, but the limit-reached notification is never fired.

## Player Experience

Players see no change. All statuses render in a flat list as they do today. The `limitId` field exists on effects but is never exposed in the player-facing template. The limit-reached chat message is whispered to GM only.
