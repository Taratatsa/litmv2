import { describe, expect, it } from "vitest";
import { parseTagStringMatch } from "../modules/utils.js";

// parseTagStringMatch consumes the regex-match shape: [full, name, separator, value].
// These tests pin down behaviour at the awkward boundaries: out-of-range tiers,
// non-numeric values, names with whitespace.

describe("parseTagStringMatch edge cases", () => {
	it("tier 0 produces an all-false tier array (out-of-range)", () => {
		const data = parseTagStringMatch(["[X-0]", "X", "-", "0"]);
		expect(data.type).toBe("status_tag");
		expect(data.system.tiers).toEqual([false, false, false, false, false, false]);
	});

	it("tier 7 produces an all-false tier array (out-of-range)", () => {
		const data = parseTagStringMatch(["[X-7]", "X", "-", "7"]);
		expect(data.system.tiers).toEqual([false, false, false, false, false, false]);
	});

	it("non-numeric tier value falls back to 0 / all-false", () => {
		const data = parseTagStringMatch(["[X-abc]", "X", "-", "abc"]);
		expect(data.system.tiers.every((v) => v === false)).toBe(true);
	});

	it("preserves internal whitespace in the tag name", () => {
		const status = parseTagStringMatch(["[Tired Out-3]", "Tired Out", "-", "3"]);
		expect(status.name).toBe("Tired Out");
		expect(status.type).toBe("status_tag");

		const story = parseTagStringMatch(["[Tired Out]", "Tired Out", "", ""]);
		expect(story.name).toBe("Tired Out");
		expect(story.type).toBe("story_tag");
	});

	it("treats colon separator as non-status (story tag)", () => {
		// CONFIG.litmv2.tagStringRe matches "-" or ":" as a separator, but only
		// "-" is treated as a status. Anything else is a story tag.
		const data = parseTagStringMatch(["[Limit:3]", "Limit", ":", "3"]);
		expect(data.type).toBe("story_tag");
		expect(data.system).toEqual({ isScratched: false, isSingleUse: false });
	});

	it("treats {name:1} as a single-use story tag (p.165)", () => {
		const data = parseTagStringMatch(["{Lucky Charm:1}", "Lucky Charm", ":", "1"]);
		expect(data.type).toBe("story_tag");
		expect(data.system).toEqual({ isScratched: false, isSingleUse: true });
	});
});
