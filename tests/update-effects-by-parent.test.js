import { describe, expect, it } from "vitest";
import { updateEffectsByParent } from "../modules/active-effects/effect-factories.js";
import { fakeActor, fakeEffect, fakeItem } from "./__helpers__/factories.js";

describe("updateEffectsByParent", () => {
	it("routes updates to each effect's owning document and batches by parent", async () => {
		const heroEffect = fakeEffect({ id: "h1", type: "story_tag" });
		const item = fakeItem({
			effects: [
				fakeEffect({ id: "i1", type: "power_tag" }),
				fakeEffect({ id: "i2", type: "power_tag" }),
			],
		});
		const actor = fakeActor({ effects: [heroEffect], items: [item] });

		await updateEffectsByParent(actor, [
			{ _id: "h1", system: { isScratched: true } },
			{ _id: "i1", disabled: false },
			{ _id: "i2", disabled: false },
		]);

		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ _id: "h1", system: { isScratched: true } },
		]);
		expect(item.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ _id: "i1", disabled: false },
			{ _id: "i2", disabled: false },
		]);
	});

	it("falls back to the actor when an effect id isn't found in applicable effects", async () => {
		const actor = fakeActor();
		await updateEffectsByParent(actor, [{ _id: "missing", disabled: true }]);

		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ _id: "missing", disabled: true },
		]);
	});

	it("is a no-op for empty updates", async () => {
		const actor = fakeActor();
		await updateEffectsByParent(actor, []);
		expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("intentionally routes an unknown id to the actor while known ids stick with their parents", async () => {
		// Locks in the fallback when the effectMap is non-empty — distinguishes
		// "matched and routed" from "missed and defaulted".
		const itemEffect = fakeEffect({ id: "i1", type: "power_tag" });
		const item = fakeItem({ effects: [itemEffect] });
		const actor = fakeActor({ items: [item] });

		await updateEffectsByParent(actor, [
			{ _id: "i1", disabled: false },
			{ _id: "ghost", disabled: true },
		]);

		expect(item.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ _id: "i1", disabled: false },
		]);
		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ _id: "ghost", disabled: true },
		]);
	});
});
