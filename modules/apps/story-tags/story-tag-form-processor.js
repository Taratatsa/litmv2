/**
 * Form-data processing for the story-tag sidebar submit handler. Three
 * stages, each addressing a distinct slice of the form:
 *
 *   - `applyActorTagUpdates` writes tag/status effect updates back to each
 *     contributing actor (heroes, fellowships, etc).
 *   - `buildStoryTagUpdates` builds the update plan for the world-level
 *     story-tag compendium pack. Pure transform — caller decides whether
 *     to apply via `ContentSources.updateStoryTags` or broadcast as a
 *     player-side `updateTags` socket request.
 *   - `applyLimitUpdates` handles both world-scoped story limits and
 *     per-actor flag limits (hero / fellowship / journey).
 *
 * Each impure stage takes a `resolveActor(id)` callback so the sidebar can
 * supply its existing UUID-or-id resolution logic without this module
 * having to know the membership rules.
 */

import { updateEffectsByParent } from "../../active-effects/effect-factories.js";
import { FLAG_LIMIT_TYPES } from "../../system/config.js";
import { toTiers } from "./story-tag-helpers.js";

/**
 * Write tag and status effect updates back to their owning actors.
 *
 * @param {Record<string, Record<string, object>>} actors  `{ [actorId]: { [effectId]: formFields } }`
 * @param {(id: string) => Actor|null} resolveActor
 */
export async function applyActorTagUpdates(actors, resolveActor) {
	for (const [actorId, tags] of Object.entries(actors)) {
		const actor = resolveActor(actorId);
		if (!actor?.isOwner) continue;

		const updates = Object.entries(tags).map(([effectId, data]) => {
			const isStatus = data.tagType === "status_tag";
			return {
				_id: effectId,
				name: data.name,
				system: isStatus
					? { tiers: toTiers(data.values) }
					: {
							isScratched: !!data.isScratched,
							isSingleUse: !!data.isSingleUse,
							limitId: data.limitId || null,
						},
			};
		});

		await updateEffectsByParent(actor, updates);
	}
}

/**
 * Build update objects for the story-tag compendium pack.
 *
 * @param {Record<string, object>} [story]  `{ [tagId]: formFields }`
 * @returns {object[]}
 */
export function buildStoryTagUpdates(story) {
	const updates = [];
	for (const [tagId, data] of Object.entries(story || {})) {
		const isStatus = data.tagType === "status_tag";
		const update = { _id: tagId, name: data.name };
		if (isStatus) {
			const rawValues = Array.isArray(data.values)
				? data.values
				: data.values != null
					? [data.values]
					: [];
			update["system.tiers"] = toTiers(rawValues);
		} else {
			update["system.isScratched"] = !!data.isScratched;
			update["system.isSingleUse"] = !!data.isSingleUse;
		}
		if (data.limitId !== undefined) {
			update["system.limitId"] = data.limitId || null;
		}
		updates.push(update);
	}
	return updates;
}

/**
 * Process limit form data for both story-scoped limits and per-actor flag
 * limits. Applies the per-actor writes in parallel and returns the new
 * story-limits array so the caller can persist it in one settings write.
 *
 * @param {object} [limitsData]               `{ story: {...}, [actorId]: {...} }`
 * @param {object[]} [currentStoryLimits]     The current world story-limits array
 * @param {(id: string) => Actor|null} resolveActor
 * @returns {Promise<object[]>} The (possibly mutated) story-limits array
 */
export async function applyLimitUpdates(
	limitsData,
	currentStoryLimits,
	resolveActor,
) {
	let updatedLimits = currentStoryLimits ?? [];
	if (!limitsData || !game.user.isGM) return updatedLimits;

	// Story limits — GM-owned world-level
	const storyLimitsData = limitsData.story;
	if (storyLimitsData) {
		updatedLimits = updatedLimits.map((limit) => {
			const formLimit = storyLimitsData[limit.id];
			if (!formLimit) return limit;
			return {
				...limit,
				label: formLimit.label ?? limit.label,
				max: formLimit.max ?? limit.max,
			};
		});
	}

	// Actor flag limits (hero / fellowship / journey)
	const flagUpdates = [];
	for (const [source, sourceLimits] of Object.entries(limitsData)) {
		if (source === "story") continue;
		const actor = resolveActor(source);
		if (!actor?.isOwner) continue;
		if (!FLAG_LIMIT_TYPES.has(actor.type)) continue;
		const existing = actor.system.limits;
		const isHero = actor.type === "hero";
		const updated = existing.map((limit) => {
			const formLimit = sourceLimits[limit.id];
			if (!formLimit) return limit;
			return {
				...limit,
				label: formLimit.label ?? limit.label,
				max: isHero ? limit.max : (formLimit.max ?? limit.max),
			};
		});
		flagUpdates.push(actor.system.setLimits(updated));
	}
	await Promise.all(flagUpdates);

	return updatedLimits;
}
