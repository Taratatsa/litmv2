import { describe, expect, it } from "vitest";
import { parseEmbeddedFormKeys } from "../modules/utils.js";

describe("parseEmbeddedFormKeys", () => {
	it("groups prefixed keys by document id and mutates submitData", () => {
		const submitData = {
			name: "Hero",
			"effects.abc.name": "Fierce",
			"effects.abc.system.isScratched": true,
			"effects.xyz.name": "Tired",
			"system.level": "origin",
		};

		const map = parseEmbeddedFormKeys(submitData, "effects.");

		expect(map).toEqual({
			abc: { name: "Fierce", system: { isScratched: true } },
			xyz: { name: "Tired" },
		});
		// Non-matching keys stay; matching ones are removed
		expect(submitData).toEqual({ name: "Hero", "system.level": "origin" });
	});

	it("returns an empty map when no keys match", () => {
		const submitData = { name: "Hero" };
		expect(parseEmbeddedFormKeys(submitData, "effects.")).toEqual({});
		expect(submitData).toEqual({ name: "Hero" });
	});

	it("handles deeply nested paths under a single id", () => {
		const submitData = {
			"effects.abc.system.foo.bar.baz": 1,
			"effects.abc.system.foo.bar.qux": 2,
		};
		const map = parseEmbeddedFormKeys(submitData, "effects.");
		expect(map).toEqual({
			abc: { system: { foo: { bar: { baz: 1, qux: 2 } } } },
		});
	});

	it("isolates the requested prefix from other prefixes", () => {
		const submitData = {
			"effects.abc.name": "kept",
			"items.xyz.name": "ignored",
		};
		const map = parseEmbeddedFormKeys(submitData, "effects.");

		expect(map).toEqual({ abc: { name: "kept" } });
		// items.* survives untouched
		expect(submitData).toEqual({ "items.xyz.name": "ignored" });
	});

	it("preserves falsy values (empty string, 0, false) in the nested map", () => {
		const submitData = {
			"effects.a.system.label": "",
			"effects.a.system.count": 0,
			"effects.a.system.flag": false,
		};
		const map = parseEmbeddedFormKeys(submitData, "effects.");
		expect(map.a.system).toEqual({ label: "", count: 0, flag: false });
	});

	it("groups multiple effect ids interleaved with non-matching keys", () => {
		const submitData = {
			"effects.a.name": "A",
			"system.level": "origin",
			"effects.b.name": "B",
			name: "Hero",
			"effects.a.system.x": 1,
		};
		const map = parseEmbeddedFormKeys(submitData, "effects.");

		expect(map).toEqual({
			a: { name: "A", system: { x: 1 } },
			b: { name: "B" },
		});
		expect(submitData).toEqual({ "system.level": "origin", name: "Hero" });
	});
});
