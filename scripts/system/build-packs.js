/**
 * Generate compendium pack source files for the litmv2 system.
 * Run with: node scripts/system/build-packs.js
 *
 * This creates JSON source files in packs/<pack>/_source/ which can be
 * compiled into LevelDB packs using: fvtt package pack <name>
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = join(import.meta.dirname, "..", "..");
const PACKS = join(ROOT, "packs");

function id() {
	return randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Map status names to Foundry SVG icons (icons/svg/) or Font Awesome classes. */
const STATUS_ICONS = {
	wounded: "icons/svg/blood.svg",
	poisoned: "icons/svg/poison.svg",
	burned: "icons/svg/fire.svg",
	stunned: "icons/svg/daze.svg",
	paralyzed: "icons/svg/paralysis.svg",
	crushed: "icons/svg/stoned.svg",
	exhausted: "icons/svg/unconscious.svg",
	hungry: "icons/svg/tankard.svg",
	scared: "icons/svg/terror.svg",
	confused: "icons/svg/daze.svg",
	convinced: "icons/svg/book.svg",
	intimidated: "icons/svg/cowled.svg",
	humiliated: "icons/svg/down.svg",
	prone: "icons/svg/falling.svg",
	exposed: "icons/svg/eye.svg",
	surprised: "icons/svg/explosion.svg",
	drained: "icons/svg/degen.svg",
	cursed: "icons/svg/skull.svg",
	warded: "icons/svg/holy-shield.svg",
	alert: "icons/svg/eye.svg",
	hidden: "icons/svg/invisible.svg",
	inspired: "icons/svg/angel.svg",
	invigorated: "icons/svg/regen.svg",
};

function statusCard(name, tier = 1) {
	const tiers = [false, false, false, false, false, false];
	for (let i = 0; i < Math.min(tier, 6); i++) tiers[i] = true;
	const _id = id();
	return {
		_id,
		_key: `!effects!${_id}`,
		name,
		type: "status_tag",
		img: STATUS_ICONS[name] ?? "icons/svg/circle.svg",
		disabled: false,
		showIcon: 0, // ACTIVE_EFFECT_SHOW_ICON.NONE — foundry globals unavailable in Node
		system: {
			isHidden: false,
			tiers,
			limitId: null,
		},
	};
}

// Curated statuses from the Action Grimoire and Core Book.
// Each covers a distinct condition space — GMs create custom
// statuses on the fly for more specific variants.
const statuses = [
	// Physical harm
	"wounded",
	"poisoned",
	"burned",
	"stunned",
	"paralyzed",
	"crushed",
	// Fatigue & needs
	"exhausted",
	"hungry",
	// Mental & emotional
	"scared",
	"confused",
	// Social
	"convinced",
	"intimidated",
	"humiliated",
	// Positional
	"prone",
	"exposed",
	"surprised",
	// Magical
	"drained",
	"cursed",
	"warded",
	// Beneficial
	"alert",
	"hidden",
	"inspired",
	"invigorated",
];

const dir = join(PACKS, "statuses", "_source");
mkdirSync(dir, { recursive: true });

for (const name of statuses) {
	const data = statusCard(name);
	const filename = `${name}_${data._id}.json`;
	writeFileSync(join(dir, filename), JSON.stringify(data, null, "\t") + "\n");
}

console.log(`Created ${statuses.length} status source files in ${dir}`);
