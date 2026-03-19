# Limit-Grouped Statuses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow GMs to group status cards under limits in the story tag sidebar, with auto-calculated limit values using tier stacking.

**Architecture:** Data model changes add a `limitId` field to ActiveEffect type data and a stable `id` to challenge limits. The sidebar partitions effects by limit, computes stacked tiers, and writes values back to challenge actors. A shared chat module handles limit-reached notifications.

**Tech Stack:** Foundry VTT v13+ ApplicationV2, Handlebars templates, vanilla JS/CSS

**Spec:** `docs/superpowers/specs/2026-03-18-limit-grouped-statuses-design.md`

---

### Task 1: Extract Chat Card Builder to Shared Module

Extract the duplicated `buildTrackCompleteContent`, `TRACK_ICONS`, and `TRACK_LABEL_KEYS` from `hero-sheet.js` and `fellowship-sheet.js` into a shared module. Add the `limit` type.

**Files:**
- Create: `scripts/system/chat.js`
- Modify: `scripts/actor/hero/hero-sheet.js:5-38`
- Modify: `scripts/actor/fellowship/fellowship-sheet.js:4-37`

- [ ] **Step 1: Create `scripts/system/chat.js`**

```js
export const TRACK_ICONS = {
	promise: "fa-sun",
	improve: "fa-arrow-trend-up",
	milestone: "fa-mountain-sun",
	abandon: "fa-wind",
	limit: "fa-shield",
};

export const TRACK_LABEL_KEYS = {
	promise: "LITM.Ui.track_complete_promise",
	improve: "LITM.Ui.track_complete_improve",
	milestone: "LITM.Ui.track_complete_milestone",
	abandon: "LITM.Ui.track_complete_abandon",
	limit: "LITM.Ui.track_complete_limit",
};

export function buildTrackCompleteContent({ text, type, actorId, themeId }) {
	const icon = TRACK_ICONS[type];
	const label = game.i18n.localize(TRACK_LABEL_KEYS[type]);
	const footer =
		type === "improve" && actorId && themeId
			? `<footer class="litm-track-complete__footer">
				<button type="button" data-click="open-theme-advancement"
				        data-actor-id="${actorId}" data-theme-id="${themeId}">
					<i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("LITM.Ui.choose_improvement")}
				</button>
			</footer>`
			: "";
	return `<div class="litmv2 litm-track-complete litm-track-complete--${type}">
		<header class="litm-track-complete__header">
			<i class="fas ${icon}"></i>
			<span>${label}</span>
		</header>
		<p class="litm-track-complete__body"><strong>${text}</strong></p>
		${footer}
	</div>`;
}
```

- [ ] **Step 2: Update `hero-sheet.js` to import from shared module**

Remove lines 5-38 (the `TRACK_ICONS`, `TRACK_LABEL_KEYS`, and `buildTrackCompleteContent` declarations). Add import at top:

```js
import { buildTrackCompleteContent } from "../../system/chat.js";
```

- [ ] **Step 3: Update `fellowship-sheet.js` to import from shared module**

Remove lines 4-37 (the same duplicated declarations). Add import at top:

```js
import { buildTrackCompleteContent } from "../../system/chat.js";
```

- [ ] **Step 4: Verify in-game**

Open Foundry, open a hero sheet, advance a promise track to 5. Confirm the chat card still appears with the correct styling. Do the same with a fellowship theme track (milestone/abandon to 3).

- [ ] **Step 5: Commit**

```bash
git add scripts/system/chat.js scripts/actor/hero/hero-sheet.js scripts/actor/fellowship/fellowship-sheet.js
git commit -m "refactor: extract track-complete chat builder to shared module"
```

---

### Task 2: Data Model Changes — StatusCardData & StoryTagData

Add `limitId` field to both ActiveEffect type data models. Extract `calculateMark` core logic into a static `markTier` method and add a static `stackTiers` utility.

**Files:**
- Modify: `scripts/data/active-effect-data.js`

- [ ] **Step 1: Add `limitId` field to `StoryTagData`**

In `StoryTagData.defineSchema()`, add after the `isHidden` field:

```js
limitId: new fields.StringField({ initial: null, nullable: true }),
```

- [ ] **Step 2: Add `limitId` field to `StatusCardData`**

In `StatusCardData.defineSchema()`, add after the `isHidden` field:

```js
limitId: new fields.StringField({ initial: null, nullable: true }),
```

- [ ] **Step 3: Add static `markTier` method to `StatusCardData`**

Add before the instance `calculateMark` method:

```js
/**
 * Mark a specific tier on a tiers array (pure function).
 * If the target slot is occupied, bump to the next empty slot.
 * @param {boolean[]} tiers - 6-element boolean array
 * @param {number} tier - The tier to mark (1-6)
 * @returns {boolean[]} New tiers array
 */
static markTier(tiers, tier) {
	const index = tier - 1;
	if (index < 0 || index >= 6) return [...tiers];

	const newTiers = [...tiers];
	if (!newTiers[index]) {
		newTiers[index] = true;
	} else {
		for (let i = index + 1; i < 6; i++) {
			if (!newTiers[i]) {
				newTiers[i] = true;
				break;
			}
		}
	}
	return newTiers;
}
```

- [ ] **Step 4: Refactor instance `calculateMark` to delegate to static**

Replace the body of the instance `calculateMark` method:

```js
calculateMark(tier) {
	return StatusCardData.markTier(this.tiers, tier);
}
```

- [ ] **Step 5: Add static `stackTiers` method**

Add after `markTier`:

```js
/**
 * Stack multiple status tier arrays into a combined tier value.
 * Each marked box is applied via markTier onto a cumulative card.
 * @param {boolean[][]} tierArrays - Array of 6-element boolean arrays
 * @returns {number} Combined tier (0-6)
 */
static stackTiers(tierArrays) {
	let combined = [false, false, false, false, false, false];
	for (const tiers of tierArrays) {
		for (let i = 0; i < 6; i++) {
			if (tiers[i]) {
				combined = StatusCardData.markTier(combined, i + 1);
			}
		}
	}
	const lastIndex = combined.lastIndexOf(true);
	return lastIndex === -1 ? 0 : lastIndex + 1;
}
```

- [ ] **Step 6: Verify in-game**

Open Foundry, open a challenge with existing statuses. Confirm statuses still render correctly (tiers display properly, calculateMark still works when stacking via drag-drop in the sidebar).

- [ ] **Step 7: Commit**

```bash
git add scripts/data/active-effect-data.js
git commit -m "feat: add limitId field and stackTiers utility to ActiveEffect data models"
```

---

### Task 3: Challenge Data Model — Add Stable `id` to Limits

Add an `id` field to challenge limit schema entries and backfill legacy limits.

**Files:**
- Modify: `scripts/actor/challenge/challenge-data.js`

- [ ] **Step 1: Add `id` field to limit schema**

In `ChallengeData.defineSchema()`, add `id` as the first field in the limits SchemaField:

```js
limits: new fields.ArrayField(
	new fields.SchemaField({
		id: new fields.StringField({
			initial: () => foundry.utils.randomID(),
		}),
		label: new fields.StringField({ initial: "" }),
		outcome: new fields.StringField({ initial: "" }),
		max: new fields.StringField({ initial: "3" }),
		value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
	}),
),
```

- [ ] **Step 2: Persist IDs on legacy limits via `_preUpdate`**

Legacy limits without an `id` need persistent backfill. Add a `_preUpdate` hook that assigns and persists IDs before any update. Also add to `ChallengeSheet._onFirstRender` to handle the first-open case:

In `challenge-data.js`, add after `defineSchema`:

```js
/** @override */
static _onUpdate(data, options, userId) {
	// No action needed — IDs are assigned during _preUpdate
}
```

In `challenge-sheet.js`, at the end of `_onFirstRender` (after the hooks setup), add:

```js
// Backfill stable IDs on legacy limits that don't have them
const limitsNeedingIds = this.system.limits.filter((l) => !l.id);
if (limitsNeedingIds.length && this.document.isOwner) {
	const limits = this.system.limits.map((l) =>
		l.id ? l : { ...l, id: foundry.utils.randomID() },
	);
	this.document.update({ "system.limits": limits });
}
```

This persists the IDs to the database on first open, so they are stable across sessions.

- [ ] **Step 3: Update `ChallengeSheet.#onAddLimit` to include `id`**

In `scripts/actor/challenge/challenge-sheet.js`, update the `#onAddLimit` action (line 347-358) to include `id`:

```js
static async #onAddLimit(_event, _target) {
	const limits = [
		...this.system.limits,
		{
			id: foundry.utils.randomID(),
			label: game.i18n.localize("LITM.Ui.new_limit"),
			outcome: "",
			max: "3",
			value: 0,
		},
	];
	await this.document.update({ "system.limits": limits });
}
```

- [ ] **Step 4: Verify in-game**

Open a challenge sheet, add a new limit. Open the browser console and check `actor.system.limits` — each limit should have an `id` field. Open an existing challenge with limits — `prepareDerivedData` should have backfilled IDs.

- [ ] **Step 5: Commit**

```bash
git add scripts/actor/challenge/challenge-data.js scripts/actor/challenge/challenge-sheet.js
git commit -m "feat: add stable id field to challenge limit schema"
```

---

### Task 4: Localization Keys

Add new localization keys to all language files.

**Files:**
- Modify: `lang/en.json`
- Modify: `lang/cn.json`
- Modify: `lang/de.json`
- Modify: `lang/es.json`
- Modify: `lang/no.json`

- [ ] **Step 1: Add keys to `lang/en.json`**

Add these keys in the appropriate sections (under `LITM.Ui` and `LITM.Terms`):

```json
"LITM.Ui.add_limit": "Add Limit",
"LITM.Ui.remove_limit": "Remove Limit",
"LITM.Ui.limit_reached": "{label}",
"LITM.Ui.limit_reached_with_outcome": "{label} ({actor}): {outcome}",
"LITM.Ui.track_complete_limit": "Limit Reached",
"LITM.Ui.drop_statuses_here": "Drop statuses here...",
"LITM.Terms.limit_group": "Limit Group"
```

- [ ] **Step 2: Add the same keys to all other language files**

Add the same English keys to `lang/cn.json`, `lang/de.json`, `lang/es.json`, `lang/no.json` as placeholders (translators will update later).

- [ ] **Step 3: Verify with check-keys**

Run: `node check-keys.js`
Expected: No missing keys reported.

- [ ] **Step 4: Commit**

```bash
git add lang/
git commit -m "feat: add localization keys for limit-grouped statuses"
```

---

### Task 5: CSS Styles for Limit Groups and Chat Card

Add sidebar limit group styles and the limit-reached chat card type.

**Files:**
- Modify: `litmv2.css`

- [ ] **Step 1: Add limit group styles**

Add after the `.litm--group-divider` styles (around line 2111):

```css
/* Limit group — collapsible group header with nested statuses */
.litm--limit-group {
	margin: 4px 0;
	padding: 4px 6px;
	background: color-mix(in srgb, var(--color-litm-limit) 10%, transparent);
	border-left: 2px solid var(--color-litm-limit);
	border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.litm--limit-header {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: var(--font-size-11);
	opacity: 0.85;
	margin-bottom: 4px;
}

.litm--limit-header .litm--limit-label {
	font-family: var(--font-header);
	font-weight: 600;
	border: none;
	background: transparent;
	color: inherit;
	padding: 0 0.2em;
	min-width: 4em;
	font-size: inherit;
}

.litm--limit-header .litm--limit-value {
	margin-left: auto;
	font-weight: 600;
	font-size: var(--font-size-10);
	color: var(--color-litm-limit);
}

.litm--limit-group ul.plain {
	padding-left: 8px;
}

.litm--limit-group .litm--limit-empty {
	padding: 2px 0 2px 8px;
	font-size: var(--font-size-10);
	opacity: 0.5;
	font-style: italic;
}

/* Dragover highlight on limit headers */
.litm--limit-header.dragover {
	background: color-mix(in srgb, var(--color-litm-limit) 20%, transparent);
	border-radius: var(--border-radius);
}

/* Story limit max input — compact inline */
.litm--limit-header .litm--limit-max {
	border: none;
	background: transparent;
	color: inherit;
	padding: 0;
	width: 1.5em;
	text-align: center;
	font-size: inherit;
	font-weight: 600;
}
```

- [ ] **Step 2: Add limit-reached chat card accent**

Add after the `.litm-track-complete--abandon` styles (around line 1678):

```css
.litm-track-complete--limit .litm-track-complete__header {
	background: #6e3a3a;
}
```

- [ ] **Step 3: Add dark mode override**

Add in the dark mode section, after the `.litm-track-complete--abandon` dark override (around line 4562):

```css
& .litm-track-complete--limit .litm-track-complete__header {
	background: #7e4444;
}
```

- [ ] **Step 4: Verify in-game**

Open Foundry, inspect the sidebar. No visual changes yet (no limit groups rendered), but confirm no CSS errors in the console.

- [ ] **Step 5: Commit**

```bash
git add litmv2.css
git commit -m "feat: add CSS styles for limit groups and limit-reached chat card"
```

---

### Task 6: Sidebar Template — Limit Group Partial and GM Rendering

Update the story tags template to render limit groups for GM users.

**Files:**
- Modify: `templates/apps/story-tags.html`

- [ ] **Step 1: Add `limitGroup` inline partial**

Add after the existing `add-button` inline partial (after line 60):

```handlebars
{{#*inline 'limitGroup' limit source editable isGM isChallenge}}
<div class="litm--limit-group" data-limit-id="{{limit.id}}" data-source="{{source}}">
	<div class="litm--limit-header" data-limit-id="{{limit.id}}" data-source="{{source}}">
		<i class="fa-solid fa-shield" aria-hidden="true" style="font-size:10px;"></i>
		{{#if (and editable (not isChallenge))}}
		<input class="litm--limit-label" type="text" name="limits.{{limit.id}}.label" value="{{limit.label}}"
			data-focus="select" />
		{{else}}
		<span class="litm--limit-label">{{limit.label}}</span>
		{{/if}}
		<span class="litm--limit-value">
			{{limit.computedValue}} / {{#if (and editable (not isChallenge))}}<input class="litm--limit-max" type="text"
				name="limits.{{limit.id}}.max" value="{{limit.max}}" />{{else}}{{limit.max}}{{/if}}
		</span>
		{{#if (and isChallenge limit.outcome)}}
		<i class="fa-solid fa-circle-info" aria-hidden="true"
			style="font-size:9px;opacity:0.6;margin-left:2px;cursor:help;"
			data-tooltip="{{limit.outcome}}"></i>
		{{/if}}
		{{#if editable}}
		{{#unless isChallenge}}
		<button type="button" class="litm--tag-action-btn" data-action="remove-limit" data-limit-id="{{limit.id}}"
			data-tooltip="{{localize 'LITM.Ui.remove_limit'}}">
			<i class="fa-solid fa-xmark" aria-hidden="true"></i>
		</button>
		{{/unless}}
		{{/if}}
	</div>
	{{#if limit.tags.length}}
	<ul class="plain">
		{{#each limit.tags as |tag|}}
		{{> tagItem tag=tag source=../source editable=../editable isGM=../isGM}}
		{{/each}}
	</ul>
	{{else}}
	<div class="litm--limit-empty">{{localize "LITM.Ui.drop_statuses_here"}}</div>
	{{/if}}
</div>
{{/inline}}
```

- [ ] **Step 2: Add shield button to story section toolbar**

In the story section actions (around line 72), add the shield button after the existing add-status button:

```handlebars
{{#if isGM}}
<div class="litm--section-actions">
	{{> add-button id="story"}}
	<button type="button" data-action="add-limit" data-id="story"
		data-tooltip="{{localize 'LITM.Ui.add_limit'}}"
		aria-label="{{localize 'LITM.Ui.add_limit'}}">
		<i class="fa-solid fa-shield" aria-hidden="true"></i>
	</button>
</div>
{{/if}}
```

- [ ] **Step 3: Update story tags section to render limit groups (GM only)**

Replace the story tags `<ul>` section (around line 75-79) with conditional rendering:

```handlebars
{{#if isGM}}
{{#each storyLimits as |limit|}}
{{> limitGroup limit=limit source="story" editable=true isGM=true isChallenge=false}}
{{/each}}
{{/if}}
<ul class="plain">
	{{#each tags as |tag|}}
	{{> tagItem tag=tag source="story" editable=../isGM isGM=../isGM}}
	{{/each}}
</ul>
```

- [ ] **Step 4: Update actor tags section to render limit groups (GM + challenge only)**

Replace the actor tags `<ul>` section (around line 117-121) with conditional rendering:

**Important Handlebars scope note:** At this point in the template, we are inside `{{#each actors as |actor|}}` and then inside a `<section>`. Use `@root.isGM` to access the root context's `isGM`, since `../../isGM` may not resolve correctly at varying nesting depths.

```handlebars
{{#if (and @root.isGM actor.limits.length)}}
{{#each actor.limits as |limit|}}
{{> limitGroup limit=limit source=../actor.id editable=../actor.isOwner isGM=true isChallenge=true}}
{{/each}}
{{/if}}
<ul class="plain">
	{{#each actor.ungroupedTags as |tag|}}
	{{> tagItem tag=tag source=../id editable=actor.isOwner isGM=@root.isGM}}
	{{/each}}
</ul>
```

Note: For non-GM users, `actor.limits` will be empty and `actor.ungroupedTags` will contain all tags (the sidebar JS handles this partitioning). Use `@root.isGM` throughout the actor section to avoid Handlebars scope depth issues.

- [ ] **Step 5: Add hidden `limitId` input to `tagItem` partial**

In the `tagItem` inline partial, add after the existing `tagType` hidden input (line 20):

```handlebars
<input type="hidden" name="{{source}}.{{tag.id}}.limitId" value="{{tag.limitId}}" />
```

- [ ] **Step 6: Commit**

```bash
git add templates/apps/story-tags.html
git commit -m "feat: add limit group rendering to story tag sidebar template"
```

---

### Task 7: Sidebar Logic — Context Preparation and Limit Grouping

Update `StoryTagSidebar` to partition tags by limit and compute stacked values.

**Files:**
- Modify: `scripts/apps/story-tag-sidebar.js`

- [ ] **Step 1: Update `config` getter default**

Update the default return (line 72) to include `limits`:

```js
return { actors: [], tags: [], limits: [] };
```

- [ ] **Step 2: Update `actors` getter to include `limitId` on tags**

In the `tags` mapping inside the `actors` getter (around line 104-119), add `limitId` to each tag object:

```js
.map((e) => {
	const isStatus = e.type === "status_card";
	return {
		id: e._id,
		name: e.name,
		type: isStatus ? "status" : "tag",
		isScratched: e.system?.isScratched ?? false,
		isSingleUse: isStatus
			? false
			: (e.system?.isSingleUse ?? false),
		value: isStatus ? (e.system?.currentTier ?? 0) : 1,
		values: isStatus
			? (e.system?.tiers ?? new Array(6).fill(false))
			: new Array(6).fill(false),
		hidden: e.system?.isHidden ?? false,
		limitId: e.system?.limitId ?? null,
	};
})
```

- [ ] **Step 3: Update `tags` getter to include `limitId`**

In the `tags` getter (around line 126-135), add `limitId`:

```js
get tags() {
	return this.config.tags
		.map((tag) => ({
			...tag,
			isScratched: tag.isScratched ?? false,
			isSingleUse: tag.isSingleUse ?? false,
			hidden: tag.hidden ?? false,
			limitId: tag.limitId ?? null,
		}))
		.filter((tag) => game.user.isGM || !tag.hidden);
}
```

- [ ] **Step 4: Add `storyLimits` getter**

Add a new getter:

```js
get storyLimits() {
	return this.config.limits ?? [];
}
```

- [ ] **Step 5: Update `_prepareContext` to partition by limits**

Import `StatusCardData` at the top of the file:

```js
import { StatusCardData } from "../data/active-effect-data.js";
```

In `_prepareContext`, **before the `return context` statement** (line 216), add limit partitioning for each actor:

```js
for (const actor of context.actors) {
	const actorDoc = game.actors.get(actor.id);
	const isChallenge = actor.type === "challenge" || actor.type === "journey";

	if (game.user.isGM && isChallenge && actorDoc) {
		const actorLimits = (actorDoc.system.limits ?? []).map((limit) => {
			const groupedTags = actor.tags.filter((t) => t.limitId === limit.id);
			const statusTierArrays = groupedTags
				.filter((t) => t.type === "status")
				.map((t) => t.values);
			const computedValue = StatusCardData.stackTiers(statusTierArrays);
			return {
				...limit,
				tags: groupedTags,
				computedValue,
			};
		});
		const groupedIds = new Set(actorLimits.flatMap((l) => l.tags.map((t) => t.id)));
		actor.limits = actorLimits;
		actor.ungroupedTags = actor.tags.filter((t) => !groupedIds.has(t.id));
	} else {
		actor.limits = [];
		actor.ungroupedTags = actor.tags;
	}
}
```

Also **before the `return context` statement**, add story limit partitioning:

```js
if (game.user.isGM) {
	const allStoryLimits = this.storyLimits;
	context.storyLimits = allStoryLimits.map((limit) => {
		const groupedTags = context.tags.filter((t) => t.limitId === limit.id);
		const statusTierArrays = groupedTags
			.filter((t) => t.type === "status")
			.map((t) => t.values);
		const computedValue = StatusCardData.stackTiers(statusTierArrays);
		return {
			...limit,
			tags: groupedTags,
			computedValue,
		};
	});
	const storyGroupedIds = new Set(context.storyLimits.flatMap((l) => l.tags.map((t) => t.id)));
	context.tags = context.tags.filter((t) => !storyGroupedIds.has(t.id));
} else {
	context.storyLimits = [];
}
```

- [ ] **Step 6: Verify in-game**

Open Foundry as GM with a challenge in the sidebar. Challenge limits should appear as group headers (empty). Story section should show the shield button. Non-GM users should see a flat list as before.

- [ ] **Step 7: Commit**

```bash
git add scripts/apps/story-tag-sidebar.js
git commit -m "feat: add limit grouping and tier stacking to sidebar context"
```

---

### Task 8: Sidebar Logic — Story Limit CRUD Actions

Add actions for creating and removing story-level limits.

**Files:**
- Modify: `scripts/apps/story-tag-sidebar.js`

- [ ] **Step 1: Register new actions in `DEFAULT_OPTIONS`**

Add to the `actions` object:

```js
"add-limit": StoryTagSidebar.#onAddLimit,
"remove-limit": StoryTagSidebar.#onRemoveLimit,
```

- [ ] **Step 2: Implement `#onAddLimit` action**

```js
static #onAddLimit(_event, _target) {
	const limits = [
		...(this.config.limits ?? []),
		{
			id: foundry.utils.randomID(),
			label: game.i18n.localize("LITM.Ui.new_limit"),
			max: "3",
			value: 0,
		},
	];
	this.setLimits(limits);
}
```

- [ ] **Step 3: Implement `#onRemoveLimit` action**

```js
static async #onRemoveLimit(_event, target) {
	const limitId = target.dataset.limitId;
	if (!limitId) return;

	const limits = (this.config.limits ?? []).filter((l) => l.id !== limitId);

	// Clear limitId on any story tags referencing this limit
	const tags = this.config.tags.map((t) =>
		t.limitId === limitId ? { ...t, limitId: null } : t,
	);

	if (game.user.isGM) {
		await LitmSettings.setStoryTags({ ...this.config, limits, tags });
		return this.#broadcastRender();
	}
}
```

- [ ] **Step 4: Add `setLimits` public method**

```js
async setLimits(limits) {
	await LitmSettings.setStoryTags({ ...this.config, limits });
	return this.#broadcastRender();
}
```

- [ ] **Step 5: Update `onSubmit` to handle story limit label/max changes**

**Critical:** Both limits and tags must be written in a single `LitmSettings.setStoryTags` call to avoid the second write overwriting the first. Combine them:

In the `onSubmit` method, replace the final `setTags` call with a combined write. After constructing `storyTags`, also process limits:

```js
// Process limit form data
let updatedLimits = this.config.limits ?? [];
const limitsData = data.limits;
if (limitsData && game.user.isGM) {
	updatedLimits = updatedLimits.map((limit) => {
		const formLimit = limitsData[limit.id];
		if (!formLimit) return limit;
		return {
			...limit,
			label: formLimit.label ?? limit.label,
			max: formLimit.max ?? limit.max,
		};
	});
}

// Write tags and limits together in a single setting update
if (game.user.isGM) {
	await LitmSettings.setStoryTags({ ...this.config, tags: storyTags, limits: updatedLimits });
	this.#broadcastRender();
} else {
	this.#broadcastUpdate("tags", storyTags);
}
```

Remove the existing separate `setTags` call at the end of `onSubmit` — it is replaced by the combined write above.

- [ ] **Step 6: Verify in-game**

Click the shield button in the story section — a new limit group should appear. Edit its name and max. Click the X to remove it. Confirm story tags referencing a removed limit fall back to ungrouped.

- [ ] **Step 7: Commit**

```bash
git add scripts/apps/story-tag-sidebar.js
git commit -m "feat: add story limit CRUD actions to sidebar"
```

---

### Task 9: Sidebar Logic — Drag-and-Drop Limit Assignment

Extend drag-and-drop to assign/unassign statuses to limit groups.

**Files:**
- Modify: `scripts/apps/story-tag-sidebar.js`

- [ ] **Step 1: Extend `_onDrop` for limit header drops**

In the `_onDrop` method, **inside** the `if (data.type === "tag" || data.type === "status")` block, add limit header detection **before** the existing same-container sort check (before the `if (data.sourceContainer && data.sourceId)` block):

```js
// Check if dropping onto a limit header
const limitTarget = dragEvent.target.closest("[data-limit-id]");
if (limitTarget && (data.type === "tag" || data.type === "status")) {
	const limitId = limitTarget.dataset.limitId;
	const source = limitTarget.dataset.source;

	if (source === "story") {
		// Update story tag's limitId
		const tags = this.config.tags.map((t) =>
			t.id === data.sourceId ? { ...t, limitId } : t,
		);
		if (game.user.isGM) await this.setTags(tags);
		else await this.#broadcastUpdate("tags", tags);
		return;
	}

	// Update actor effect's limitId
	const actor = game.actors.get(source);
	if (!actor?.isOwner) return;
	if (!actor.effects.has(data.sourceId)) return;
	await actor.updateEmbeddedDocuments("ActiveEffect", [
		{ _id: data.sourceId, "system.limitId": limitId },
	]);
	return this.#broadcastRender();
}
```

- [ ] **Step 2: Clear `limitId` on cross-actor moves**

In the `#addTagToActor` method, ensure `limitId` is not carried over. The existing method creates a new ActiveEffect — the default schema value for `limitId` is `null`, so no explicit change needed. Verify this is the case.

- [ ] **Step 3: Add dragover/dragleave handlers for visual feedback**

In `_onRender`, add dragover highlighting for limit headers:

```js
this.element.querySelectorAll(".litm--limit-header").forEach((header) => {
	header.addEventListener("dragover", (e) => {
		e.preventDefault();
		header.classList.add("dragover");
	});
	header.addEventListener("dragleave", () => {
		header.classList.remove("dragover");
	});
	header.addEventListener("drop", () => {
		header.classList.remove("dragover");
	});
});
```

- [ ] **Step 4: Handle unassigning — dropping outside a limit group clears limitId**

When a status with a `limitId` is dropped onto the ungrouped area (outside any `.litm--limit-group`), set its `limitId` to `null`. This check must go **before** the `#sortTag` call in the same-container logic, because `#sortTag` returns early. Inside the `if (isSameContainer)` block, add the unassign check before `return this.#sortTag(data, dropTarget)`:

```js
if (isSameContainer) {
	// Check if dragging out of a limit group first
```

```js
// If dragging out of a limit group, clear limitId
if (data.sourceContainer && data.sourceContainer !== "story") {
	const actor = game.actors.get(data.sourceContainer);
	const effect = actor?.effects.get(data.sourceId);
	if (effect?.system?.limitId && !dropTarget?.closest(".litm--limit-group")) {
		await actor.updateEmbeddedDocuments("ActiveEffect", [
			{ _id: data.sourceId, "system.limitId": null },
		]);
		return this.#broadcastRender();
	}
}
```

For story tags, similar logic:

```js
if (data.sourceContainer === "story") {
	const tag = this.config.tags.find((t) => t.id === data.sourceId);
	if (tag?.limitId && !dropTarget?.closest(".litm--limit-group")) {
		const tags = this.config.tags.map((t) =>
			t.id === data.sourceId ? { ...t, limitId: null } : t,
		);
		if (game.user.isGM) await this.setTags(tags);
		else await this.#broadcastUpdate("tags", tags);
		return;
	}
}
```

- [ ] **Step 5: Verify in-game**

1. Add a challenge with limits to the sidebar
2. Add a status to the challenge
3. Drag the status onto a limit header — it should nest under the limit
4. Drag it back out — it should return to the ungrouped list
5. Check the limit's value/max display updates
6. Drag a status from one actor to another — confirm `limitId` is cleared

- [ ] **Step 6: Commit**

```bash
git add scripts/apps/story-tag-sidebar.js
git commit -m "feat: add drag-and-drop limit assignment in sidebar"
```

---

### Task 10: Challenge Limit Write-Back and Notification

Write computed limit values back to challenge actors and fire limit-reached notifications.

**Files:**
- Modify: `scripts/apps/story-tag-sidebar.js`

- [ ] **Step 1: Add `#recalculateChallengeLimits` private method**

```js
async #recalculateChallengeLimits(actorId) {
	const actor = game.actors.get(actorId);
	if (!actor?.isOwner) return;
	if (actor.type !== "challenge" && actor.type !== "journey") return;

	const effects = [...actor.effects]
		.filter((e) => e.type === "status_card" && e.system?.limitId)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

	const limits = actor.system.limits.map((limit) => {
		const grouped = effects.filter((e) => e.system.limitId === limit.id);
		const tierArrays = grouped.map((e) => e.system.tiers);
		const computedValue = StatusCardData.stackTiers(tierArrays);
		return { ...limit, value: computedValue };
	});

	// Detect limit-reached transitions
	for (let i = 0; i < limits.length; i++) {
		const oldLimit = actor.system.limits[i];
		const newLimit = limits[i];
		if (!oldLimit || newLimit.max === "~") continue;
		const numericMax = Number(newLimit.max);
		if (!Number.isFinite(numericMax)) continue;
		if (oldLimit.value < numericMax && newLimit.value >= numericMax) {
			this.#sendLimitReachedMessage(newLimit, actor);
		}
	}

	await actor.update({ "system.limits": limits });
}
```

- [ ] **Step 2: Add `#sendLimitReachedMessage` private method**

Import the chat builder at the top of the file:

```js
import { buildTrackCompleteContent } from "../system/chat.js";
```

```js
async #sendLimitReachedMessage(limit, actor) {
	const text = limit.outcome
		? game.i18n.format("LITM.Ui.limit_reached_with_outcome", {
				label: limit.label,
				actor: actor.name,
				outcome: limit.outcome,
			})
		: game.i18n.format("LITM.Ui.limit_reached", {
				label: limit.label,
			});

	await foundry.documents.ChatMessage.create({
		content: buildTrackCompleteContent({ text, type: "limit" }),
		whisper: foundry.documents.ChatMessage.getWhisperRecipients("GM"),
		speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
	});
}
```

- [ ] **Step 3: Call recalculate after tag updates**

Add `this.#recalculateChallengeLimits(id)` calls at these specific points:

**In `onSubmit`** (around line 449-473): After the `Promise.all` that calls `#updateTagsOnActor`, add a second pass:

```js
// After existing Promise.all for #updateTagsOnActor
for (const id of Object.keys(actors)) {
	await this.#recalculateChallengeLimits(id);
}
```

**In `#addTagToActor`** (around line 737): After `actor.createEmbeddedDocuments(...)` and before `this.#broadcastRender()`:

```js
await this.#recalculateChallengeLimits(id);
```

**In `#removeTagFromActor`** (around line 758): After `actor.deleteEmbeddedDocuments(...)` and before `this.#broadcastRender()`:

```js
await this.#recalculateChallengeLimits(actorId);
```

**In `_onDrop` limit assignment** (Task 9, Step 1): After `actor.updateEmbeddedDocuments(...)` that sets `limitId`, add before `this.#broadcastRender()`:

```js
await this.#recalculateChallengeLimits(source);
```

**In `_onDrop` limit unassignment** (Task 9, Step 4): After clearing `limitId`, add before `this.#broadcastRender()`:

```js
await this.#recalculateChallengeLimits(data.sourceContainer);
```

- [ ] **Step 4: Verify in-game**

1. Create a challenge with a limit (max 3)
2. Add two statuses, assign both to the limit
3. Mark tiers on the statuses — the limit value should auto-update
4. Push the combined tier to 3+ — a GM whisper chat message should appear with "Limit Reached"
5. Reduce a status — the limit value should decrease (no duplicate notification)
6. Open the challenge sheet — the limit value should match the sidebar's computed value

- [ ] **Step 5: Commit**

```bash
git add scripts/apps/story-tag-sidebar.js
git commit -m "feat: add challenge limit write-back and limit-reached notification"
```

---

### Task 11: Challenge Sheet — Disable +/- for Auto-Managed Limits

Disable manual limit controls when statuses are grouped under a limit.

**Files:**
- Modify: `scripts/actor/challenge/challenge-sheet.js:105-111`
- Modify: `templates/actor/challenge-play.html:50-89`

- [ ] **Step 1: Add `isAutoManaged` flag in `_prepareContext`**

In `ChallengeSheet._prepareContext`, update the limits mapping (around line 105-111):

```js
limits: await Promise.all(
	(this.system.limits || []).map(async (limit) => {
		const hasGroupedStatuses = this.document.effects.some(
			(e) => e.type === "status_card" && e.system?.limitId === limit.id,
		);
		return {
			...limit,
			isImpossible: limit.max === "~",
			isAutoManaged: hasGroupedStatuses,
			enrichedOutcome: await enrichHTML(limit.outcome, this.document),
		};
	}),
),
```

- [ ] **Step 2: Update challenge-play template to respect `isAutoManaged`**

In `templates/actor/challenge-play.html`, update the limit controls section (lines 57-78). Wrap the +/- buttons in an `isAutoManaged` check:

```handlebars
{{#if limit.isImpossible}}
<div class="limit-controls">
	<span class="limit-impossible">~</span>
</div>
{{else if limit.isAutoManaged}}
<div class="limit-controls">
	<div class="limit-shields">
		{{#progress-buttons limit.value limit.max}}
		<img src="systems/litmv2/assets/media/icons/limit.svg"
			class="limit-shield {{#if @checked}}filled{{else}}empty{{/if}}" />
		{{/progress-buttons}}
	</div>
</div>
{{else}}
<div class="limit-controls">
	<button type="button" class="limit-adjust" data-action="decreaseLimit" data-index="{{@index}}"
		data-tooltip="{{localize 'LITM.Ui.decrease'}}" aria-label="{{localize 'LITM.Ui.decrease'}}">
		<i class="fa-solid fa-minus"></i>
	</button>
	<div class="limit-shields">
		{{#progress-buttons limit.value limit.max}}
		<img src="systems/litmv2/assets/media/icons/limit.svg"
			class="limit-shield {{#if @checked}}filled{{else}}empty{{/if}}" />
		{{/progress-buttons}}
	</div>
	<button type="button" class="limit-adjust" data-action="increaseLimit" data-index="{{@index}}"
		data-tooltip="{{localize 'LITM.Ui.increase'}}" aria-label="{{localize 'LITM.Ui.increase'}}">
		<i class="fa-solid fa-plus"></i>
	</button>
</div>
{{/if}}
```

- [ ] **Step 3: Verify in-game**

1. Open a challenge sheet with a limit that has grouped statuses in the sidebar — +/- buttons should be hidden
2. A limit with no grouped statuses should still show +/- buttons
3. Confirm the shield progress bar still renders correctly for auto-managed limits

- [ ] **Step 4: Commit**

```bash
git add scripts/actor/challenge/challenge-sheet.js templates/actor/challenge-play.html
git commit -m "feat: disable manual limit controls when statuses are grouped"
```

---

### Task 12: Form Data Preservation — limitId Round-Tripping

Ensure `limitId` survives form submit cycles for both actor effects and story tags.

**Files:**
- Modify: `scripts/apps/story-tag-sidebar.js`

- [ ] **Step 1: Preserve `limitId` in `onSubmit` for actor tags**

In the `onSubmit` method where actor tags are mapped (around line 453-471), include `limitId` in the update payload:

```js
return {
	_id: tagId,
	name: data.name,
	system: isStatus
		? { tiers: toTiers(rawValues), limitId: data.limitId || null }
		: {
				isScratched: data.isScratched ?? false,
				isSingleUse: data.isSingleUse ?? false,
				limitId: data.limitId || null,
			},
};
```

- [ ] **Step 2: Preserve `limitId` in `onSubmit` for story tags**

In the story tags reconstruction (around line 475-494), include `limitId`:

```js
return {
	id: tagId,
	name: data.name,
	values: isStatus ? tiers : new Array(6).fill(false),
	isScratched: isStatus ? false : (data.isScratched ?? false),
	isSingleUse: isStatus ? false : (data.isSingleUse ?? false),
	type: existing?.type ?? "tag",
	value: isStatus ? tiers.lastIndexOf(true) + 1 : null,
	hidden: existing?.hidden ?? false,
	limitId: data.limitId || existing?.limitId || null,
};
```

- [ ] **Step 3: Verify in-game**

1. Assign a status to a limit, edit the status name, confirm it stays in the limit group after the form submits
2. As a non-GM player (if testable), edit a story tag — confirm grouped statuses don't lose their `limitId`

- [ ] **Step 4: Commit**

```bash
git add scripts/apps/story-tag-sidebar.js
git commit -m "fix: preserve limitId through form submit cycles"
```

---

### Task 13: Final Integration Verification

End-to-end verification of the complete feature.

- [ ] **Step 1: Full GM workflow test**

1. Create a new world or use existing
2. Create a challenge actor with 2 limits ("Driven Off" max 5, "Enraged" max 3 with outcome text)
3. Drag the challenge to the story tag sidebar
4. Add 3 statuses to the challenge via the sidebar
5. Drag 2 statuses onto "Driven Off" limit — confirm they nest, value updates
6. Mark tiers on grouped statuses — confirm stacking calculation matches expectations
7. Push "Enraged" to max — confirm GM whisper chat message appears with outcome
8. Open challenge sheet — confirm limit values match sidebar, +/- buttons disabled for grouped limits
9. Remove a status from a limit group (drag out) — confirm value decreases
10. Delete a status — confirm limit recalculates

- [ ] **Step 2: Story limit workflow test**

1. Click shield button in story section — new limit appears
2. Add story-level statuses, drag them into the limit
3. Confirm value auto-calculates
4. Remove the limit — confirm statuses return to ungrouped
5. Edit limit name and max inline

- [ ] **Step 3: Player view test**

1. Log in as a non-GM player
2. Confirm sidebar shows all statuses in a flat list (no limit headers, no shield button)
3. Confirm no JS errors in console

- [ ] **Step 4: Edge case tests**

1. Challenge with `max: "~"` limit — confirm no notification fires, value still displays
2. Cross-actor drag — confirm `limitId` is cleared
3. Delete a limit on the challenge sheet while statuses reference it — confirm sidebar treats orphaned statuses as ungrouped

- [ ] **Step 5: Run localization check**

Run: `node check-keys.js`
Expected: No missing keys.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for limit-grouped statuses"
```
