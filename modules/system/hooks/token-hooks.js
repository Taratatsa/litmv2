import { onCanvasPan, onHoverToken } from "../../hud/token-tooltip.js";

export function registerTokenHooks() {
	Hooks.on("hoverToken", onHoverToken);
	Hooks.on("canvasPan", onCanvasPan);
}
