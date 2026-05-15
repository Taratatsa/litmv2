import { ACTOR_TYPES } from "../system/config.js";

/**
 * Custom Actor document class for Legend in the Mist.
 *
 * Filters the fellowship type out of the Actor creation dialog so players
 * cannot accidentally create duplicate fellowship actors.
 */
export class LitmActor extends foundry.documents.Actor {
	static async createDialog(data = {}, createOptions = {}, dialogOptions = {}) {
		dialogOptions.types ??= this.TYPES.filter(
			(t) => t !== ACTOR_TYPES.fellowship,
		);
		return super.createDialog(data, createOptions, dialogOptions);
	}
}
