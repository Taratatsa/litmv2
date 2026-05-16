import { beforeEach, describe, expect, it, vi } from "vitest";
import { storyTagEffect } from "../modules/active-effects/effect-factories.js";
import { fakeActor, fakeItem } from "./__helpers__/factories.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("actor.system.addStoryTag", () => {
	it("routes a hero's story tag through the backpack item, not the actor", async () => {
		const backpack = fakeItem({ type: "backpack" });
		const actor = fakeActor({
			type: "hero",
			system: {
				backpackItem: backpack,
				async addStoryTag(effectData) {
					if (!this.backpackItem) {
						ui.notifications.warn(
							game.i18n.localize("LITM.Ui.warn_no_backpack"),
						);
						return;
					}
					return this.backpackItem.createEmbeddedDocuments("ActiveEffect", [
						{ ...effectData, transfer: true },
					]);
				},
			},
		});
		const data = storyTagEffect({ name: "lantern" });

		await actor.system.addStoryTag(data);

		expect(backpack.createEmbeddedDocuments).toHaveBeenCalledWith(
			"ActiveEffect",
			[{ ...data, transfer: true }],
		);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("warns and bails when a hero has no backpack", async () => {
		const actor = fakeActor({
			type: "hero",
			system: {
				backpackItem: null,
				async addStoryTag(effectData) {
					if (!this.backpackItem) {
						ui.notifications.warn(
							game.i18n.localize("LITM.Ui.warn_no_backpack"),
						);
						return;
					}
					return this.backpackItem.createEmbeddedDocuments("ActiveEffect", [
						{ ...effectData, transfer: true },
					]);
				},
			},
		});

		const result = await actor.system.addStoryTag(
			storyTagEffect({ name: "x" }),
		);

		expect(result).toBeUndefined();
		expect(ui.notifications.warn).toHaveBeenCalledWith(
			"LITM.Ui.warn_no_backpack",
		);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("creates the effect directly on a non-hero actor", async () => {
		const actor = fakeActor({
			type: "challenge",
			system: {
				async addStoryTag(effectData) {
					return actor.createEmbeddedDocuments("ActiveEffect", [
						{ ...effectData, transfer: false },
					]);
				},
			},
		});
		const data = storyTagEffect({ name: "ambush" });

		await actor.system.addStoryTag(data);

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			{ ...data, transfer: false },
		]);
	});
});
