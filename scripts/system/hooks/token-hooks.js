// scripts/system/hooks/token-hooks.js
import { info } from "../../logger.js";
import { onHoverToken, onCanvasPan } from "../../hud/token-tooltip.js";

/**
 * Load the statuses compendium and populate CONFIG.statusEffects.
 */
async function _loadStatusCompendium() {
	const pack = game.packs.get("litmv2.statuses");
	if (!pack) return;
	const docs = await pack.getDocuments();
	CONFIG.statusEffects = docs.map((doc) => ({
		id: doc.name.slugify({ strict: true }),
		_id: doc.id,
		name: doc.name,
		img: doc.img,
	}));
	info(`Loaded ${docs.length} statuses from compendium`);
}

export function registerTokenHooks() {
	Hooks.on("ready", _loadStatusCompendium);
	Hooks.on("hoverToken", onHoverToken);
	Hooks.on("canvasPan", onCanvasPan);
}
