# Token Magix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom TokenHUD with compendium-sourced statuses (with tier boxes) and a hover tooltip showing active tags/statuses.

**Architecture:** `LitmTokenHUD` subclasses Foundry's `TokenHUD`, overriding `_getStatusEffectChoices` and the toggle handler to work with the system's `status_tag` ActiveEffects. A separate tooltip module listens to `hoverToken` and renders a DOM overlay with styled badges. Both are wired through a new `token-hooks.js` hook module.

**Tech Stack:** FoundryVTT v14 ApplicationV2/HUD APIs, Handlebars templates, system ActiveEffect types

---

### Task 1: Token Hooks Module

**Files:**
- Create: `scripts/system/hooks/token-hooks.js`
- Modify: `scripts/system/hooks/index.js`

This task creates the registration scaffold that the later tasks will fill in.

- [ ] **Step 1: Create token-hooks.js with stub functions**

```javascript
// scripts/system/hooks/token-hooks.js
import { info } from "../../logger.js";

/**
 * Load the statuses compendium and populate CONFIG.statusEffects.
 */
async function _loadStatusCompendium() {
	const pack = game.packs.get("litmv2.statuses");
	if (!pack) return;
	const docs = await pack.getDocuments();
	CONFIG.statusEffects = docs.map((doc) => ({
		id: doc.name.slugify({ strict: true }),
		_id: doc.id,
		name: doc.name,
		img: doc.img,
	}));
	info(`Loaded ${docs.length} statuses from compendium`);
}

export function registerTokenHooks() {
	Hooks.on("ready", _loadStatusCompendium);
}
```

- [ ] **Step 2: Register in hooks/index.js**

Add import and call in `LitmHooks.register()`:

```javascript
import { registerTokenHooks } from "./token-hooks.js";
```

Add `registerTokenHooks();` as the last call inside `register()`.

- [ ] **Step 3: Verify manually**

Launch Foundry, open browser console, check that `CONFIG.statusEffects` is populated with entries from the statuses pack after the world loads. Verify with:
```javascript
console.log(CONFIG.statusEffects);
```

- [ ] **Step 4: Commit**

```
feat: Load statuses compendium into CONFIG.statusEffects
```

---

### Task 2: LitmTokenHUD Subclass — Basic Override

**Files:**
- Create: `scripts/hud/litm-token-hud.js`
- Modify: `litmv2.js`

- [ ] **Step 1: Create the HUD subclass with custom status choices**

```javascript
// scripts/hud/litm-token-hud.js
const { TokenHUD } = foundry.applications.hud;

export class LitmTokenHUD extends TokenHUD {
	static DEFAULT_OPTIONS = {
		actions: {
			effect: { handler: LitmTokenHUD.#onToggleEffect, buttons: [0, 2] },
			tier: LitmTokenHUD.#onClickTier,
		},
	};

	static PARTS = {
		hud: {
			root: true,
			template: "templates/hud/token-hud.hbs",
		},
		effects: {
			template: "systems/litmv2/templates/hud/token-hud-effects.html",
		},
	};

	/**
	 * Diff the compendium index against CONFIG.statusEffects and rebuild if stale.
	 */
	async #syncStatuses() {
		const pack = game.packs.get("litmv2.statuses");
		if (!pack) return;
		const index = await pack.getIndex();
		const currentIds = new Set(CONFIG.statusEffects.map((s) => s._id));
		const indexIds = new Set(index.map((e) => e._id));
		const stale =
			currentIds.size !== indexIds.size ||
			[...indexIds].some((id) => !currentIds.has(id));
		if (!stale) return;
		const docs = await pack.getDocuments();
		CONFIG.statusEffects = docs.map((doc) => ({
			id: doc.name.slugify({ strict: true }),
			_id: doc.id,
			name: doc.name,
			img: doc.img,
		}));
	}

	/** @override */
	async _prepareContext(options) {
		await this.#syncStatuses();
		return super._prepareContext(options);
	}

	/**
	 * Override to match active status_tag effects by name instead of statuses Set.
	 * @override
	 */
	_getStatusEffectChoices() {
		const choices = {};
		const statuses = Object.values(CONFIG.statusEffects).sort(
			(a, b) =>
				(a.order ?? 0) - (b.order ?? 0) ||
				(a.name ?? "").localeCompare(b.name ?? "", game.i18n.lang),
		);

		for (const status of statuses) {
			choices[status.id] = {
				_id: status._id,
				id: status.id,
				title: status.name,
				src: status.img,
				isActive: false,
				isOverlay: false,
				cssClass: "",
				tiers: null,
				currentTier: 0,
			};
		}

		// Match active status_tag effects on the actor by name
		const activeEffects = this.actor?.effects ?? [];
		for (const effect of activeEffects) {
			if (effect.type !== "status_tag") continue;
			const slug = effect.name.slugify({ strict: true });
			const status = choices[slug];
			if (!status) continue;
			status.isActive = true;
			status.effectId = effect.id;
			status.tiers = [...effect.system.tiers];
			status.currentTier = effect.system.currentTier;
		}

		for (const status of Object.values(choices)) {
			status.cssClass = status.isActive ? "active" : "";
		}
		return choices;
	}

	/**
	 * Handle toggling a status effect — creates/removes status_tag ActiveEffects.
	 * Left-click: add at tier 1 if not present, remove if present.
	 * Right-click: remove entirely.
	 * @this {LitmTokenHUD}
	 */
	static async #onToggleEffect(event, target) {
		if (!this.actor) {
			ui.notifications.warn("HUD.WarningEffectNoActor", { localize: true });
			return;
		}
		const statusId = target.dataset.statusId;
		const choice = this._getStatusEffectChoices()[statusId];
		if (!choice) return;

		// Right-click or already active: remove
		if (choice.isActive) {
			await this.actor.deleteEmbeddedDocuments("ActiveEffect", [
				choice.effectId,
			]);
		} else {
			// Left-click on inactive: create at tier 1
			const { statusTagEffect } = await import("../../utils.js");
			const effectData = statusTagEffect({ name: choice.title });
			effectData.system.tiers = [true, false, false, false, false, false];
			effectData.img = choice.src;
			await this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
		}
	}

	/**
	 * Handle clicking a tier box on an active status.
	 * @this {LitmTokenHUD}
	 */
	static async #onClickTier(event, target) {
		const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
		const tier = Number(target.dataset.tier);
		if (!effectId || !tier) return;

		const effect = this.actor.effects.get(effectId);
		if (!effect) return;

		const newTiers = effect.system.calculateMark(tier);
		// If all tiers are already marked up to this one, unmark from this tier up
		const currentTier = effect.system.currentTier;
		if (tier <= currentTier) {
			// Unmark: set all tiers from this index onward to false
			const unmarkTiers = [...effect.system.tiers];
			for (let i = tier - 1; i < 6; i++) unmarkTiers[i] = false;
			// If no tiers remain, remove the effect
			if (unmarkTiers.every((t) => !t)) {
				await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
				return;
			}
			await effect.update({ "system.tiers": unmarkTiers });
		} else {
			await effect.update({ "system.tiers": newTiers });
		}
	}
}
```

- [ ] **Step 2: Register the HUD class in litmv2.js**

Add import at the top of `litmv2.js`:

```javascript
import { LitmTokenHUD } from "./scripts/hud/litm-token-hud.js";
```

Add this line after `CONFIG.litmv2 = new LitmConfig();` (after line 118):

```javascript
CONFIG.Token.hudClass = LitmTokenHUD;
```

- [ ] **Step 3: Verify manually**

Launch Foundry, place a token, right-click it. The HUD should appear. The status effects button on the right should open a palette showing statuses from the compendium (as icons). Clicking one should create a `status_tag` effect on the actor.

- [ ] **Step 4: Commit**

```
feat: LitmTokenHUD subclass with status_tag effect creation
```

---

### Task 3: Custom Status Effects Template with Tier Boxes

**Files:**
- Create: `templates/hud/token-hud-effects.html`
- Modify: `scripts/hud/litm-token-hud.js`

- [ ] **Step 1: Create the custom effects template**

```handlebars
{{!-- templates/hud/token-hud-effects.html --}}
{{#each statusEffects as |status|}}
<div class="litm-hud-status {{status.cssClass}}" data-status-id="{{status.id}}"
	{{#if status.effectId}}data-effect-id="{{status.effectId}}"{{/if}}>
	<img class="effect-control" src="{{status.src}}" data-action="effect"
		data-status-id="{{status.id}}"
		{{#if status.title}}data-tooltip-text="{{status.title}}"{{/if}}>
	{{#if status.isActive}}
	<div class="litm-hud-tiers">
		{{#each status.tiers}}
		<button type="button" class="litm-hud-tier {{#if this}}checked{{/if}}"
			data-action="tier" data-tier="{{sum @index 1}}"></button>
		{{/each}}
	</div>
	{{/if}}
</div>
{{/each}}
```

- [ ] **Step 2: Update LitmTokenHUD to use the custom template**

The PARTS definition already includes the `effects` part. Now update `_prepareContext` to pass the effects data for the partial, and override `_configureRenderParts` to inject the effects part into the HUD's status palette.

Replace the `PARTS` definition in `litm-token-hud.js`:

```javascript
static PARTS = {
	hud: {
		root: true,
		template: "templates/hud/token-hud.hbs",
	},
};
```

Then override `_onRender` to replace the status palette content with our custom rendering:

```javascript
/** @override */
async _onRender(context, options) {
	await super._onRender(context, options);
	const palette = this.element.querySelector('.palette[data-palette="effects"]');
	if (!palette) return;
	const html = await foundry.applications.handlebars.renderTemplate(
		"systems/litmv2/templates/hud/token-hud-effects.html",
		{ statusEffects: context.statusEffects },
	);
	palette.innerHTML = html;
}
```

- [ ] **Step 3: Register a Handlebars helper for sum**

Check if Foundry v14 already has a `sum` helper. If not, add in `scripts/system/handlebars.js` inside `HandlebarsHelpers.register()`:

```javascript
Handlebars.registerHelper("sum", (a, b) => a + b);
```

- [ ] **Step 4: Add CSS for the HUD tier boxes**

Add to `litmv2.css`:

```css
/* Token HUD status effects */
.litm-hud-status {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 1px;
	border-radius: 3px;
}

.litm-hud-status.active {
	background: var(--color-cool-5-25);
}

.litm-hud-status .effect-control {
	width: 24px;
	height: 24px;
	border: none;
	cursor: pointer;
}

.litm-hud-status.active .effect-control {
	opacity: 1;
}

.litm-hud-tiers {
	display: flex;
	gap: 1px;
}

.litm-hud-tier {
	width: 10px;
	height: 10px;
	border: 1px solid var(--color-border-dark-tertiary);
	border-radius: 2px;
	background: transparent;
	padding: 0;
	cursor: pointer;
}

.litm-hud-tier.checked {
	background: var(--color-litm-status);
}
```

- [ ] **Step 5: Verify manually**

Open Foundry, click a token, open the status palette. Statuses should show as icons. Click one to add it — it should now show with 6 tier boxes next to it, first one checked. Click tier boxes to mark/unmark tiers. Right-click the icon to remove.

- [ ] **Step 6: Commit**

```
feat: Custom status effects template with tier checkboxes
```

---

### Task 4: Hover Tooltip

**Files:**
- Create: `scripts/hud/token-tooltip.js`
- Modify: `scripts/system/hooks/token-hooks.js`

- [ ] **Step 1: Create the tooltip module**

```javascript
// scripts/hud/token-tooltip.js

const TOOLTIP_ID = "litm-token-tooltip";

/**
 * Build tooltip HTML from an actor's story tags and status effects.
 * Respects isHidden — hidden tags only visible to GM/owner.
 * @param {Actor} actor
 * @param {boolean} isOwnerOrGM
 * @returns {string} HTML string, or empty string if no visible tags
 */
function _buildTooltipHTML(actor, isOwnerOrGM) {
	const storyTags = actor.system.storyTags ?? [];
	const statuses = actor.system.statusEffects ?? [];

	const visibleTags = storyTags.filter(
		(e) => isOwnerOrGM || !e.system.isHidden,
	);
	const visibleStatuses = statuses.filter(
		(e) => isOwnerOrGM || !e.system.isHidden,
	);

	if (!visibleTags.length && !visibleStatuses.length) return "";

	const parts = [];
	for (const tag of visibleTags) {
		parts.push(
			`<span class="litm-tag" data-text="${tag.name}">${tag.name}</span>`,
		);
	}
	for (const status of visibleStatuses) {
		const tier = status.system.currentTier;
		const label = tier > 0 ? `${status.name} ${tier}` : status.name;
		parts.push(
			`<span class="litm-status" data-text="${label}">${label}</span>`,
		);
	}
	return parts.join("");
}

/**
 * Position and show the tooltip element above a token.
 * @param {Token} token
 */
function _showTooltip(token) {
	_removeTooltip();

	const actor = token.actor;
	if (!actor) return;

	const isOwnerOrGM = game.user.isGM || actor.isOwner;
	const html = _buildTooltipHTML(actor, isOwnerOrGM);
	if (!html) return;

	const tooltip = document.createElement("div");
	tooltip.id = TOOLTIP_ID;
	tooltip.innerHTML = html;
	document.getElementById("hud").append(tooltip);

	_positionTooltip(token, tooltip);
}

/**
 * Position the tooltip centered above the token.
 * @param {Token} token
 * @param {HTMLElement} tooltip
 */
function _positionTooltip(token, tooltip) {
	const { x, y, width, height } = token.bounds;
	const scale = canvas.dimensions.uiScale;
	const screenX = (x + width / 2) * scale;
	const screenY = y * scale;

	tooltip.style.left = `${screenX}px`;
	tooltip.style.top = `${screenY}px`;
	tooltip.style.transform = `translate(-50%, -100%) scale(${scale})`;
}

/**
 * Remove the tooltip element from the DOM.
 */
function _removeTooltip() {
	document.getElementById(TOOLTIP_ID)?.remove();
}

/**
 * Handle the hoverToken hook.
 * @param {Token} token
 * @param {boolean} hovered
 */
export function onHoverToken(token, hovered) {
	if (hovered) _showTooltip(token);
	else _removeTooltip();
}

/**
 * Clean up tooltip on canvas pan or tear down.
 */
export function onCanvasPan() {
	_removeTooltip();
}
```

- [ ] **Step 2: Register tooltip hooks in token-hooks.js**

Add imports and hook registrations:

```javascript
import { onHoverToken, onCanvasPan } from "../../hud/token-tooltip.js";
```

Inside `registerTokenHooks()`, add:

```javascript
Hooks.on("hoverToken", onHoverToken);
Hooks.on("canvasPan", onCanvasPan);
```

- [ ] **Step 3: Add tooltip CSS**

Add to `litmv2.css`:

```css
/* Token hover tooltip */
#litm-token-tooltip {
	position: absolute;
	z-index: 100;
	pointer-events: none;
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	padding: 4px 6px;
	background: var(--color-cool-5-75);
	border-radius: var(--border-radius);
	max-width: 300px;
	justify-content: center;
	transform-origin: bottom center;
}

#litm-token-tooltip .litm-tag,
#litm-token-tooltip .litm-status {
	font-size: var(--font-size-12);
}
```

- [ ] **Step 4: Verify manually**

Place a token with a hero that has story tags and/or status effects. Hover over the token — a tooltip should appear above it showing styled tag/status badges. Status tags should show their tier number. Hidden tags should only appear for GM or owner. Tooltip should disappear on unhover and on canvas pan.

- [ ] **Step 5: Commit**

```
feat: Token hover tooltip showing active tags and statuses
```

---

### Task 5: Integration Testing & Polish

**Files:**
- Possibly modify: `scripts/hud/litm-token-hud.js`, `scripts/hud/token-tooltip.js`, `litmv2.css`

- [ ] **Step 1: Test full HUD workflow**

Manual test checklist:
1. Right-click token → HUD appears with status palette button
2. Open palette → all 23 compendium statuses visible as icons
3. Left-click "wounded" → status_tag effect created at tier 1, tier boxes appear
4. Click tier 3 box → tiers 1-3 marked (cascading via calculateMark)
5. Click tier 2 box (already checked) → tiers 2+ unmarked, only tier 1 remains
6. Click tier 1 box (only remaining) → effect removed entirely
7. Right-click an active status icon → effect removed immediately

- [ ] **Step 2: Test tooltip workflow**

Manual test checklist:
1. Hero with story tags + status effects → hover shows both types
2. Status tooltip shows tier number (e.g., "wounded 3")
3. Hidden tag on hero → only visible when logged in as GM or owner
4. Challenge actor with status effects → tooltip works
5. Token with no tags/statuses → no tooltip rendered
6. Pan canvas while hovering → tooltip removed

- [ ] **Step 3: Test compendium sync**

1. Open compendium, add a custom status entry
2. Close and re-open the token HUD
3. New status should appear in the palette

- [ ] **Step 4: Fix any issues found during testing**

Address any layout, positioning, or interaction issues discovered during manual testing.

- [ ] **Step 5: Commit**

```
fix: Token magix polish from integration testing
```
