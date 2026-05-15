import { describe, expect, it, vi } from "vitest";
import { ScratchableMixin } from "../modules/active-effects/scratchable-mixin.js";

// Minimal base + a fake parent so we can exercise the mixin without booting
// an ActiveEffectTypeDataModel.
class Base {}
const Scratchable = ScratchableMixin(Base);

const makeInstance = (isScratched = false) => {
	const instance = new Scratchable();
	instance.isScratched = isScratched;
	instance.parent = { update: vi.fn().mockResolvedValue(undefined) };
	return instance;
};

describe("ScratchableMixin.isSuppressed", () => {
	it("returns isScratched", () => {
		expect(makeInstance(false).isSuppressed).toBe(false);
		expect(makeInstance(true).isSuppressed).toBe(true);
	});
});

describe("ScratchableMixin.toggleScratch", () => {
	it("flips false -> true on the parent document", async () => {
		const instance = makeInstance(false);
		await instance.toggleScratch();
		expect(instance.parent.update).toHaveBeenCalledWith({
			"system.isScratched": true,
		});
	});

	it("flips true -> false on the parent document", async () => {
		const instance = makeInstance(true);
		await instance.toggleScratch();
		expect(instance.parent.update).toHaveBeenCalledWith({
			"system.isScratched": false,
		});
	});

	it("returns the parent.update promise (lets callers await it)", async () => {
		const instance = makeInstance(false);
		instance.parent.update = vi.fn().mockResolvedValue("ok");
		await expect(instance.toggleScratch()).resolves.toBe("ok");
	});
});
