import { statusTagEffect } from "../utils.js";

/**
 * Mixin that adds universal tag/status getters to actor data models.
 * Returns ActiveEffect[] directly — no plain object mapping.
 * @param {typeof TypeDataModel} Base
 * @returns {typeof TypeDataModel}
 */
export function EffectTagsMixin(Base) {
	return class extends Base {
		/**
		 * All story_tag effects on this actor.
		 * @returns {ActiveEffect[]}
		 */
		get storyTags() {
			const { storyTags } = this.#partitionEffects();
			return storyTags;
		}

		/**
		 * All status_tag effects on this actor.
		 * @returns {ActiveEffect[]}
		 */
		get statusEffects() {
			const { statusEffects } = this.#partitionEffects();
			return statusEffects;
		}

		/**
		 * The document that owns status effects for this actor.
		 * Override in subclasses to route to a different parent (e.g. backpack).
		 * @returns {Actor|Item}
		 */
		get statusParent() {
			return this.parent;
		}

		/**
		 * Create a status_tag effect on the actor.
		 * @param {string} name
		 * @param {object} [options]
		 * @param {boolean[]} [options.tiers]
		 * @param {string} [options.img]
		 * @returns {Promise<ActiveEffect[]>}
		 */
		async addStatus(name, { tiers, img } = {}) {
			const data = statusTagEffect({ name });
			if (tiers) data.system.tiers = tiers;
			if (img) data.img = img;
			const parent = this.statusParent;
			if (parent !== this.parent) data.transfer = true;
			return parent.createEmbeddedDocuments("ActiveEffect", [data]);
		}

		/**
		 * Remove a status_tag effect by ID.
		 * Finds the effect's actual parent document and deletes from there.
		 * @param {string} effectId
		 * @returns {Promise<ActiveEffect[]>}
		 */
		async removeStatus(effectId) {
			for (const e of this.parent.allApplicableEffects()) {
				if (e.id !== effectId) continue;
				const owner = e.parent;
				return owner.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
			}
		}

		#partitionEffects() {
			const storyTags = [];
			const statusEffects = [];
			for (const e of this.parent.allApplicableEffects()) {
				if (e.type === "story_tag") storyTags.push(e);
				else if (e.type === "status_tag") statusEffects.push(e);
			}
			return { storyTags, statusEffects };
		}
	};
}
