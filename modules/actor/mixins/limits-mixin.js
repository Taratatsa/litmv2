import { StatusTagData } from "../../active-effects/index.js";
import { getActorLimits, setActorLimits } from "./actor-limits.js";

/**
 * Mixin that adds a uniform limit-access protocol to actor data models.
 *
 * Default behaviour (flag-backed — hero, fellowship, journey):
 *   - `get limits()`              → reads `flags.litmv2.limits`
 *   - `async setLimits(limits)`   → writes `flags.litmv2.limits`
 *   - `getEffectiveMax(limit)`    → `limit.max`
 *
 * ChallengeData overrides `get limits()` and `setLimits()`.
 * HeroData overrides `getEffectiveMax()`.
 *
 * @param {typeof TypeDataModel} Base
 * @returns {typeof TypeDataModel}
 */
export function LimitsMixin(Base) {
	return class extends Base {
		/**
		 * All limits for this actor.
		 * Default: reads from `flags.litmv2.limits` (flag-backed actors).
		 * @returns {object[]}
		 */
		get limits() {
			return getActorLimits(this.parent);
		}

		/**
		 * Persist an updated limits array.
		 * Default: writes to `flags.litmv2.limits` (flag-backed actors).
		 * @param {object[]} limits
		 * @returns {Promise<void>}
		 */
		async setLimits(limits) {
			return setActorLimits(this.parent, limits);
		}

		/**
		 * The effective max for a limit, potentially overriding the stored value.
		 * Default: `limit.max`. HeroData overrides to apply the global heroLimit setting.
		 * @param {object} limit
		 * @returns {number}
		 */
		getEffectiveMax(limit) {
			return limit.max;
		}

		/**
		 * Recompute each limit's `value` from the actor's current status_tag tiers,
		 * persist the results, and return which limits just crossed their threshold.
		 *
		 * Only runs when the actor has limits and is the owner.
		 *
		 * @returns {Promise<{ reached: object[] }>}
		 */
		async recalculateLimitValues() {
			if (!this.parent?.isOwner) return { reached: [] };

			const oldLimits = this.limits;
			if (!oldLimits.length) return { reached: [] };

			const effects = [...this.parent.allApplicableEffects()]
				.filter((e) => e.type === "status_tag" && e.system?.limitId)
				.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

			const newLimits = oldLimits.map((limit) => {
				const grouped = effects.filter((e) => e.system.limitId === limit.id);
				const tierArrays = grouped.map((e) => e.system.tiers);
				const computedValue = StatusTagData.stackedTier(tierArrays);
				return { ...limit, value: computedValue };
			});

			// Detect limits that crossed their threshold during this call
			const reached = [];
			for (let i = 0; i < newLimits.length; i++) {
				const oldLimit = oldLimits[i];
				const newLimit = newLimits[i];
				const effectiveMax = this.getEffectiveMax(newLimit);
				if (!oldLimit || effectiveMax === 0) continue;
				if (oldLimit.value < effectiveMax && newLimit.value >= effectiveMax) {
					reached.push({ ...newLimit, max: effectiveMax });
				}
			}

			await this.setLimits(newLimits);
			return { reached };
		}
	};
}
