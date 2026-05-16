import { ITEM_TYPES, THEME_TAG_TYPES } from "../../system/config.js";
import { advanceFlagLimit } from "../mixins/actor-limits.js";
import { EffectTagsMixin } from "../mixins/effect-tags-mixin.js";
import { LimitsMixin } from "../mixins/limits-mixin.js";

export class FellowshipData extends LimitsMixin(
	EffectTagsMixin(foundry.abstract.TypeDataModel),
) {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			description: new fields.HTMLField({ initial: "" }),
		};
	}

	get theme() {
		return this.parent.items.find(
			(item) => item.type === ITEM_TYPES.theme && item.system.isFellowship,
		);
	}

	get storyThemes() {
		return this.parent.items.filter(
			(item) => item.type === ITEM_TYPES.story_theme,
		);
	}

	get allTags() {
		return [...this.parent.allApplicableEffects()].filter((e) =>
			THEME_TAG_TYPES.has(e.type),
		);
	}

	/**
	 * All tags applicable to a roll for this fellowship actor.
	 * Returns raw ActiveEffect instances; callers are responsible for mapping to plain objects.
	 * @returns {ActiveEffect[]}
	 */
	get allRollTags() {
		return [...this.allTags, ...this.storyTags, ...this.statusEffects];
	}

	/**
	 * Advance (or set back) a flag-stored limit by `delta`.
	 * @param {string} limitId
	 * @param {number} delta
	 * @returns {Promise<import("../actor-limits.js").LimitChangeResult|null>}
	 */
	async advanceLimit(limitId, delta) {
		return advanceFlagLimit(this.parent, limitId, delta);
	}
}
