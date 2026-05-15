import { describe, expect, it } from "vitest";
import { EffectTagsMixin } from "../modules/actor/effect-tags-mixin.js";
import { fakeActor, fakeEffect, fakeItem } from "./__helpers__/factories.js";

// Build a fake TypeDataModel-like base so the mixin can extend it.
class BaseModel {
	prepareDerivedData() {}
}
const TaggedModel = EffectTagsMixin(BaseModel);

const buildModel = (actor) => {
	const model = new TaggedModel();
	model.parent = actor;
	return model;
};

describe("EffectTagsMixin.storyTags / statusEffects", () => {
	it("partitions story_tag and status_tag effects from all applicable sources", () => {
		const backpack = fakeItem({
			type: "backpack",
			effects: [fakeEffect({ type: "story_tag", name: "lantern" })],
		});
		const actor = fakeActor({
			effects: [
				fakeEffect({ type: "story_tag", name: "blessed" }),
				fakeEffect({ type: "status_tag", name: "tired" }),
			],
			items: [backpack],
		});
		const model = buildModel(actor);

		expect(model.storyTags.map((e) => e.name).sort()).toEqual([
			"blessed",
			"lantern",
		]);
		expect(model.statusEffects.map((e) => e.name)).toEqual(["tired"]);
	});

	it("caches results until prepareDerivedData runs", () => {
		const actor = fakeActor({
			effects: [fakeEffect({ type: "story_tag", name: "a" })],
		});
		const model = buildModel(actor);
		const first = model.storyTags;
		const second = model.storyTags;
		expect(second).toBe(first);

		// Add an effect — cache is stale, but accessor still returns cached
		actor.effects.push(fakeEffect({ type: "story_tag", name: "b" }));
		expect(model.storyTags).toBe(first);

		// prepareDerivedData clears cache → next access re-partitions
		model.prepareDerivedData();
		expect(model.storyTags).not.toBe(first);
		expect(model.storyTags.map((e) => e.name)).toEqual(["a", "b"]);
	});
});

describe("EffectTagsMixin.addStatus", () => {
	it("creates a status_tag effect via the parent actor", async () => {
		const actor = fakeActor();
		const model = buildModel(actor);

		await model.addStatus("Tired");

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith(
			"ActiveEffect",
			expect.arrayContaining([
				expect.objectContaining({ type: "status_tag", name: "Tired" }),
			]),
		);
	});

	it("forwards tiers and img options into the effect data", async () => {
		const actor = fakeActor();
		const model = buildModel(actor);
		const tiers = [false, false, true, false, false, false];

		await model.addStatus("Bruised", { tiers, img: "icons/svg/x.svg" });

		const [, [data]] = actor.createEmbeddedDocuments.mock.calls[0];
		expect(data.system.tiers).toBe(tiers);
		expect(data.img).toBe("icons/svg/x.svg");
	});

	it("omits img and uses the factory's default tiers when no options are passed", async () => {
		const actor = fakeActor();
		const model = buildModel(actor);

		await model.addStatus("Tired");

		const [, [data]] = actor.createEmbeddedDocuments.mock.calls[0];
		// img absent -> Foundry uses field initial; we don't synthesise undefined
		expect("img" in data).toBe(false);
		// Default tiers come from statusTagEffect factory: 6-element all-false
		expect(data.system.tiers).toEqual([
			false,
			false,
			false,
			false,
			false,
			false,
		]);
	});
});

describe("EffectTagsMixin.removeStatus", () => {
	it("deletes the effect from its actual parent (an embedded item, not the actor)", async () => {
		const effect = fakeEffect({
			id: "eff-1",
			type: "status_tag",
			name: "tired",
		});
		const item = fakeItem({ effects: [effect] });
		const actor = fakeActor({ items: [item] });
		const model = buildModel(actor);

		await model.removeStatus("eff-1");

		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			"eff-1",
		]);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("deletes via the actor when the effect lives directly on the actor", async () => {
		const effect = fakeEffect({ id: "eff-2", type: "status_tag" });
		const actor = fakeActor({ effects: [effect] });
		const model = buildModel(actor);

		await model.removeStatus("eff-2");

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			"eff-2",
		]);
	});

	it("is a no-op when no effect matches the id", async () => {
		const actor = fakeActor({ effects: [fakeEffect({ id: "other" })] });
		const model = buildModel(actor);

		await model.removeStatus("missing");

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
