/**
 * Tag-string parsing utilities. The tag-string format is what users type into
 * a description box (or what an addon item declares in `system.tags`) to
 * produce a tag at runtime. Used by:
 *   - the addon-effect sync in modules/system/hooks/item-hooks.js
 *   - the story-tag drop handler in StoryTagSidebar
 *   - the renderer-utils chip pipeline
 *
 * The format supports two shapes:
 *   [name]            → story_tag
 *   [name!]           → single-use story_tag (Action Grimoire convention)
 *   [name:1]          → single-use story_tag (legacy Core Book p.165)
 *   [name-tier]       → status_tag with that tier marked
 *
 * The regex producing the match lives at CONFIG.litmv2.tagStringRe.
 */

/**
 * Convert a tag-string regex match into ActiveEffect creation data.
 * @param {RegExpMatchArray} match  A match from CONFIG.litmv2.tagStringRe
 * @returns {{ name: string, type: string, system: object }}
 */
export function parseTagStringMatch(match) {
	const [, name, exclamation, separator, value] = match;
	const isStatus = separator === "-";
	if (isStatus) {
		const tier = Number.parseInt(value, 10) || 0;
		return {
			name,
			type: "status_tag",
			system: { tiers: Array.from({ length: 6 }, (_, i) => i + 1 === tier) },
		};
	}
	const isSingleUse =
		exclamation === "!" || (separator === ":" && value === "1");
	return {
		name,
		type: "story_tag",
		system: { isScratched: false, isSingleUse },
	};
}
