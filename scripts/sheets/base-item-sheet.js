import { LitmSheetMixin } from "./litm-sheet-mixin.js";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Base item sheet class for Legend in the Mist
 * Provides common functionality for all item sheet types
 */
export class LitmItemSheet extends LitmSheetMixin(
	HandlebarsApplicationMixin(ItemSheetV2),
) {}
