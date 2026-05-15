import { describe, expect, it } from "vitest";
import { makeTagStringRe } from "../modules/system/config.js";
import { parseTagStringMatch } from "../modules/utils.js";

// parseTagStringMatch consumes the regex-match shape:
//   [full, name, exclamation, separator, value]
// These tests pin down behaviour at the awkward boundaries: out-of-range tiers,
// non-numeric values, names with whitespace, single-use markers.

describe("parseTagStringMatch edge cases", () => {
	it("tier 0 produces an all-false tier array (out-of-range)", () => {
		const data = parseTagStringMatch(["[X-0]", "X", undefined, "-", "0"]);
		expect(data.type).toBe("status_tag");
		expect(data.system.tiers).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
		]);
	});

	it("tier 7 produces an all-false tier array (out-of-range)", () => {
		const data = parseTagStringMatch(["[X-7]", "X", undefined, "-", "7"]);
		expect(data.system.tiers).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
		]);
	});

	it("non-numeric tier value falls back to 0 / all-false", () => {
		const data = parseTagStringMatch(["[X-abc]", "X", undefined, "-", "abc"]);
		expect(data.system.tiers.every((v) => v === false)).toBe(true);
	});

	it("preserves internal whitespace in the tag name", () => {
		const status = parseTagStringMatch([
			"[Tired Out-3]",
			"Tired Out",
			undefined,
			"-",
			"3",
		]);
		expect(status.name).toBe("Tired Out");
		expect(status.type).toBe("status_tag");

		const story = parseTagStringMatch([
			"[Tired Out]",
			"Tired Out",
			undefined,
			"",
			"",
		]);
		expect(story.name).toBe("Tired Out");
		expect(story.type).toBe("story_tag");
	});

	it("treats colon separator as non-status (story tag)", () => {
		// tagStringRe matches "-" or ":" as a separator, but only "-" is treated
		// as a status. Anything else is a story tag.
		const data = parseTagStringMatch([
			"[Limit:3]",
			"Limit",
			undefined,
			":",
			"3",
		]);
		expect(data.type).toBe("story_tag");
		expect(data.system).toEqual({ isScratched: false, isSingleUse: false });
	});

	it("treats {name:1} as a single-use story tag (legacy p.165 syntax)", () => {
		const data = parseTagStringMatch([
			"{Lucky Charm:1}",
			"Lucky Charm",
			undefined,
			":",
			"1",
		]);
		expect(data.type).toBe("story_tag");
		expect(data.system).toEqual({ isScratched: false, isSingleUse: true });
	});

	it("treats [name!] as a single-use story tag (Action Grimoire syntax)", () => {
		const re = makeTagStringRe();
		const matches = [..."[silver dagger!]".matchAll(re)];
		expect(matches).toHaveLength(1);
		const data = parseTagStringMatch(matches[0]);
		expect(data.type).toBe("story_tag");
		expect(data.name).toBe("silver dagger");
		expect(data.system.isSingleUse).toBe(true);
	});

	it("regex strips the `!` marker from the captured name", () => {
		const re = makeTagStringRe();
		const matches = [..."[map!]".matchAll(re)];
		expect(matches[0][1]).toBe("map");
		expect(matches[0][2]).toBe("!");
	});

	it("regex still parses [name] without `!` as a regular tag", () => {
		const re = makeTagStringRe();
		const matches = [..."[map]".matchAll(re)];
		expect(matches[0][1]).toBe("map");
		expect(matches[0][2]).toBeUndefined();
		const data = parseTagStringMatch(matches[0]);
		expect(data.system.isSingleUse).toBe(false);
	});

	it("regex parses [name-N] for status with tier", () => {
		const re = makeTagStringRe();
		const matches = [..."[wounded-2]".matchAll(re)];
		const data = parseTagStringMatch(matches[0]);
		expect(data.type).toBe("status_tag");
		expect(data.system.tiers).toEqual([
			false,
			true,
			false,
			false,
			false,
			false,
		]);
	});

	it("regex parses [name-] as variable-tier (all-false)", () => {
		const re = makeTagStringRe();
		const matches = [..."[wounded-]".matchAll(re)];
		const data = parseTagStringMatch(matches[0]);
		expect(data.type).toBe("status_tag");
		expect(data.system.tiers.every((v) => v === false)).toBe(true);
	});
});
