import { describe, expect, it } from "vitest";
import { resolveEffect } from "../modules/active-effects/effect-queries.js";
import { fakeActor, fakeEffect, fakeItem } from "./__helpers__/factories.js";

describe("resolveEffect", () => {
	it("finds an effect that lives directly on the actor", () => {
		const target = fakeEffect({ id: "e1", type: "story_tag" });
		const actor = fakeActor({ effects: [target] });

		expect(resolveEffect("e1", actor)).toBe(target);
	});

	it("finds an effect on an embedded item via allApplicableEffects", () => {
		const target = fakeEffect({ id: "e2", type: "power_tag" });
		const theme = fakeItem({ effects: [target] });
		const actor = fakeActor({ items: [theme] });

		expect(resolveEffect("e2", actor)).toBe(target);
	});

	it("falls back to the fellowship actor when fellowship: true and not found locally", () => {
		const target = fakeEffect({ id: "fe1", type: "fellowship_tag" });
		const fellowship = fakeActor({ type: "fellowship", effects: [target] });
		const actor = fakeActor({ system: { fellowshipActor: fellowship } });

		expect(resolveEffect("fe1", actor, { fellowship: true })).toBe(target);
	});

	it("does not consult the fellowship actor when fellowship: false (default)", () => {
		const target = fakeEffect({ id: "fe2", type: "fellowship_tag" });
		const fellowship = fakeActor({ type: "fellowship", effects: [target] });
		const actor = fakeActor({ system: { fellowshipActor: fellowship } });

		expect(resolveEffect("fe2", actor)).toBeNull();
	});

	it("returns null for an unknown id, even with fellowship enabled", () => {
		const fellowship = fakeActor({ type: "fellowship" });
		const actor = fakeActor({ system: { fellowshipActor: fellowship } });

		expect(resolveEffect("ghost", actor, { fellowship: true })).toBeNull();
	});
});
