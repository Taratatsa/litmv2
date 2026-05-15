import { beforeEach, describe, expect, it, vi } from "vitest";
import { addStoryTagToActor, storyTagEffect } from "../modules/utils.js";
import { fakeActor, fakeItem } from "./__helpers__/factories.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("addStoryTagToActor", () => {
	it("routes a hero's story tag through the backpack item, not the actor", async () => {
		const backpack = fakeItem({ type: "backpack" });
		const actor = fakeActor({
			type: "hero",
			system: { backpackItem: backpack },
		});
		const data = storyTagEffect({ name: "lantern" });

		await addStoryTagToActor(actor, data);

		expect(backpack.createEmbeddedDocuments).toHaveBeenCalledWith(
			"ActiveEffect",
			[data],
		);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("warns and bails when a hero has no backpack", async () => {
		const actor = fakeActor({ type: "hero", system: { backpackItem: null } });

		const result = await addStoryTagToActor(
			actor,
			storyTagEffect({ name: "x" }),
		);

		expect(result).toBeUndefined();
		expect(ui.notifications.warn).toHaveBeenCalledWith(
			"LITM.Ui.warn_no_backpack",
		);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("creates the effect directly on a non-hero actor", async () => {
		const actor = fakeActor({ type: "challenge" });
		const data = storyTagEffect({ name: "ambush" });

		await addStoryTagToActor(actor, data);

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			data,
		]);
	});
});
