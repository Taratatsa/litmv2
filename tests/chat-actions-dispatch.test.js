import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySuccess } from "../modules/system/chat-actions.js";
import { fakeActor, fakeEffect, fakeItem } from "./__helpers__/factories.js";

// The pickers open real DialogV2s. Replace them with vi.fn so tests can drive
// the resolved-target shape directly. (Most cases use self-target verbs that
// skip the picker entirely.)
vi.mock("../modules/apps/target-picker.js", () => ({
	pickTargetActor: vi.fn(),
	pickLimit: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// Helper: hero with a backpack so addStoryTagToActor can route through it.
const heroActor = (overrides = {}) => {
	const backpack = fakeItem({ type: "backpack" });
	return fakeActor({
		type: "hero",
		system: { backpackItem: backpack },
		...overrides,
	});
};

describe("applySuccess — unsupported verb", () => {
	it("notifies and returns null", async () => {
		const result = await applySuccess({
			success: { verb: "lessen", payload: {} },
			actor: heroActor(),
		});
		expect(result).toBeNull();
		expect(ui.notifications.info).toHaveBeenCalledWith(
			"LITM.Actions.lessen_not_implemented",
		);
	});
});

describe("applySuccess — permission check", () => {
	it("warns and returns null when target is not owned and user is not GM", async () => {
		const actor = heroActor({ isOwner: false });
		const result = await applySuccess({
			success: { verb: "bestow", payload: { tagName: "Resolve" } },
			actor,
		});
		expect(result).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("applySuccess — createOrTag (self-target)", () => {
	it("creates a story tag on the hero's backpack from payload.tagName", async () => {
		const actor = heroActor();
		const result = await applySuccess({
			success: { verb: "bestow", payload: { tagName: "Sharp Eyes" } },
			actor,
		});

		expect(result.appliedSummary).toBe("LITM.Actions.applied_create_tag");
		expect(actor.system.backpackItem.createEmbeddedDocuments).toHaveBeenCalledWith(
			"ActiveEffect",
			[
				expect.objectContaining({
					type: "story_tag",
					name: "Sharp Eyes",
					system: expect.objectContaining({ isSingleUse: false }),
				}),
			],
		);
	});

	it("forwards isSingleUse from payload to the story tag", async () => {
		const actor = heroActor();
		await applySuccess({
			success: { verb: "bestow", payload: { tagName: "Spark", isSingleUse: true } },
			actor,
		});

		const [, [data]] = actor.system.backpackItem.createEmbeddedDocuments.mock.calls[0];
		expect(data.system.isSingleUse).toBe(true);
	});

	it("creates a fresh status when payload has tier and no existing status matches", async () => {
		const actor = heroActor();
		// `create` verb has no defaultStatus, so we need to send a status payload
		// without a tagName to force the status branch.
		await applySuccess({
			success: { verb: "create", payload: { statusName: "Bruised", tier: 2 } },
			actor,
		});

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
			expect.objectContaining({
				type: "status_tag",
				name: "Bruised",
				system: expect.objectContaining({
					tiers: [false, true, false, false, false, false],
				}),
			}),
		]);
	});

	it("stacks onto an existing same-named status via calculateMark", async () => {
		const calculateMark = vi.fn(() => [false, false, true, false, false, false]);
		const existing = fakeEffect({
			id: "s1",
			type: "status_tag",
			name: "Bruised",
			system: { tiers: [false, true, false, false, false, false], calculateMark },
		});
		const actor = heroActor({ effects: [existing] });

		const result = await applySuccess({
			success: { verb: "create", payload: { statusName: "Bruised", tier: 2 } },
			actor,
		});

		expect(calculateMark).toHaveBeenCalledWith(2);
		expect(existing.update).toHaveBeenCalledWith({
			"system.tiers": [false, false, true, false, false, false],
		});
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(result.appliedSummary).toBe("LITM.Actions.applied_create_status");
	});

	it("scratches an existing same-named tag when payload.scratchTag is set", async () => {
		const toggleScratch = vi.fn().mockResolvedValue(undefined);
		const existing = fakeEffect({
			id: "t1",
			type: "story_tag",
			name: "Lantern",
			system: { isScratched: false, toggleScratch },
		});
		const actor = heroActor({ effects: [existing] });

		const result = await applySuccess({
			success: {
				verb: "bestow",
				payload: { tagName: "Lantern", scratchTag: true },
			},
			actor,
		});

		expect(toggleScratch).toHaveBeenCalled();
		expect(result.appliedSummary).toBe("LITM.Actions.applied_scratch");
		expect(actor.system.backpackItem.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("falls through to creation when scratchTag is set but nothing matches", async () => {
		const actor = heroActor();

		await applySuccess({
			success: {
				verb: "bestow",
				payload: { tagName: "Ghost", scratchTag: true },
			},
			actor,
		});

		expect(actor.system.backpackItem.createEmbeddedDocuments).toHaveBeenCalled();
	});
});

describe("applySuccess — restore", () => {
	it("reduces a multi-tier status by removing its highest tier", async () => {
		const status = fakeEffect({
			id: "s1",
			type: "status_tag",
			name: "Bruised",
			system: { tiers: [true, true, true, false, false, false] },
		});
		const actor = heroActor({ effects: [status] });

		const result = await applySuccess({
			success: { verb: "restore", payload: { statusName: "Bruised" } },
			actor,
		});

		expect(status.update).toHaveBeenCalledWith({
			"system.tiers": [true, true, false, false, false, false],
		});
		expect(status.delete).not.toHaveBeenCalled();
		expect(result.appliedSummary).toBe("LITM.Actions.applied_reduced");
	});

	it("deletes a status when only its lowest tier remains", async () => {
		const status = fakeEffect({
			id: "s2",
			type: "status_tag",
			name: "Tired",
			system: { tiers: [true, false, false, false, false, false] },
		});
		const actor = heroActor({ effects: [status] });

		await applySuccess({
			success: { verb: "restore", payload: { statusName: "Tired" } },
			actor,
		});

		expect(status.delete).toHaveBeenCalled();
		expect(status.update).not.toHaveBeenCalled();
	});

	it("unscratches a scratched tag of the same name when no status matches", async () => {
		const tag = fakeEffect({
			id: "t1",
			type: "story_tag",
			name: "Lantern",
			system: { isScratched: true },
		});
		const actor = heroActor({ effects: [tag] });

		const result = await applySuccess({
			success: { verb: "restore", payload: { tagName: "Lantern" } },
			actor,
		});

		expect(tag.update).toHaveBeenCalledWith({ "system.isScratched": false });
		expect(result.appliedSummary).toBe("LITM.Actions.applied_unscratched");
	});

	it("notifies and returns null when nothing matches", async () => {
		const actor = heroActor();

		const result = await applySuccess({
			success: { verb: "restore", payload: { tagName: "Nothing" } },
			actor,
		});

		expect(result).toBeNull();
		expect(ui.notifications.info).toHaveBeenCalled();
	});
});

describe("applySuccess — discover", () => {
	it("returns the success description without touching the actor", async () => {
		const actor = heroActor();
		const result = await applySuccess({
			success: {
				verb: "discover",
				payload: {},
				description: "A hidden passage glints behind the tapestry.",
			},
			actor,
		});

		expect(result).toEqual({
			appliedSummary: "A hidden passage glints behind the tapestry.",
		});
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("falls back to label, then to default localization key", async () => {
		const actor = heroActor();

		const withLabel = await applySuccess({
			success: { verb: "discover", payload: {}, label: "A clue" },
			actor,
		});
		expect(withLabel.appliedSummary).toBe("A clue");

		const fallback = await applySuccess({
			success: { verb: "discover", payload: {} },
			actor,
		});
		expect(fallback.appliedSummary).toBe("LITM.Actions.discover_default");
	});
});

describe("applySuccess — weaken (opponent target, mocked picker)", () => {
	it("deletes a named status on the picked opponent", async () => {
		const { pickTargetActor } = await import("../modules/apps/target-picker.js");
		const status = fakeEffect({
			id: "s1",
			type: "status_tag",
			name: "Blessed",
			system: { tiers: [false, false, true, false, false, false] },
		});
		const opponent = fakeActor({ name: "Beast", effects: [status] });
		pickTargetActor.mockResolvedValue(opponent);

		const result = await applySuccess({
			success: { verb: "weaken", payload: { statusName: "Blessed" } },
			actor: heroActor(),
		});

		expect(status.delete).toHaveBeenCalled();
		expect(result.appliedSummary).toBe("LITM.Actions.applied_weaken_status");
	});

	it("returns null when the picker is cancelled", async () => {
		const { pickTargetActor } = await import("../modules/apps/target-picker.js");
		pickTargetActor.mockResolvedValue(null);

		const result = await applySuccess({
			success: { verb: "weaken", payload: { tagName: "Anything" } },
			actor: heroActor(),
		});

		expect(result).toBeNull();
	});

	it("warns and returns null when payload has no name", async () => {
		const { pickTargetActor } = await import("../modules/apps/target-picker.js");
		pickTargetActor.mockResolvedValue(fakeActor({ name: "Beast" }));

		const result = await applySuccess({
			success: { verb: "weaken", payload: {} },
			actor: heroActor(),
		});

		expect(result).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalledWith(
			"LITM.Actions.apply_weaken_needs_name",
		);
	});
});
