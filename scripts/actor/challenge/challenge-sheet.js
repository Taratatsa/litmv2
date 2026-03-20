import { LitmActorSheet } from "../../sheets/base-actor-sheet.js";
import { TagStringSyncMixin } from "../../sheets/tag-string-sync-mixin.js";
import { confirmDelete, enrichHTML } from "../../utils.js";

/**
 * Challenge sheet for Legend in the Mist
 * Represents NPCs, obstacles, and challenges for heroes to overcome
 */
export class ChallengeSheet extends TagStringSyncMixin(LitmActorSheet) {
	/** @override */
	static DEFAULT_OPTIONS = {
		classes: ["litm", "litm-challenge-sheet"],
		tag: "form",
		actions: {
			addLimit: ChallengeSheet.#onAddLimit,
			removeLimit: ChallengeSheet.#onRemoveLimit,
			increaseLimit: ChallengeSheet.#onIncreaseLimit,
			decreaseLimit: ChallengeSheet.#onDecreaseLimit,
			addVignette: LitmActorSheet._onAddVignette,
			removeVignette: LitmActorSheet._onRemoveVignette,
			editVignette: LitmActorSheet._onEditVignette,
			adjustRating: ChallengeSheet.#onAdjustRating,
			addMight: ChallengeSheet.#onAddMight,
			removeMight: ChallengeSheet.#onRemoveMight,
		},
		form: {
			handler: ChallengeSheet.#onSubmitChallengeForm,
			submitOnChange: true,
			closeOnSubmit: false,
		},
		window: {
			icon: "fa-solid fa-dragon",
			resizable: true,
			controls: [],
		},
		dragDrop: [{ dropSelector: null }],
	};

	/** @override */
	static PARTS = {
		form: {
			template: "systems/litmv2/templates/actor/challenge.html",
			scrollable: [""],
		},
	};

	/** @override */
	static _getEditModeTemplate() {
		return "systems/litmv2/templates/actor/challenge.html";
	}

	/** @override */
	static _getPlayModeTemplate() {
		return "systems/litmv2/templates/actor/challenge-play.html";
	}

	/* -------------------------------------------- */
	/*  Rendering                                   */
	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Enrich HTML fields for display (but not for editing)
		const enrichedSpecialFeatures = await enrichHTML(
			this.system.specialFeatures,
			this.document,
		);
		const enrichedDescription = await enrichHTML(
			this.system.description,
			this.document,
		);

		// Enrich the tags string for play mode display
		const enrichedTags = await enrichHTML(
			this.system.tags || "",
			this.document,
		);

		// Prepare vignette items
		const { vignettes, vignettesByType } = await this._prepareVignettes();

		return {
			...context,
			isOwner: this.document.isOwner,
			isEditMode: this._isEditMode,
			enriched: {
				description: enrichedDescription,
				specialFeatures: enrichedSpecialFeatures,
				tags: enrichedTags,
			},
			tagsString: this.system.tags || "",
			vignettes,
			vignettesByType,
			displayVignettes: vignettes,
			challenges: this.system.challenges,
			limits: await Promise.all(
				(this.system.limits || []).map(async (limit) => {
					const hasGroupedStatuses = this.document.effects.some(
						(e) => e.type === "status_card" && e.system?.limitId === limit.id,
					);
					return {
						...limit,
						isImpossible: limit.max === 0,
						isAutoManaged: hasGroupedStatuses,
						enrichedOutcome: await enrichHTML(limit.outcome, this.document),
					};
				}),
			),
			rating: this.system.rating,
			might: await Promise.all(
				(this.system.might || []).map(async (entry) => ({
					...entry,
					enrichedDescription: await enrichHTML(
						entry.description,
						this.document,
					),
				})),
			),
			mightOptions: {
				origin: "LITM.Terms.origin",
				adventure: "LITM.Terms.adventure",
				greatness: "LITM.Terms.greatness",
			},
		};
	}

	/* -------------------------------------------- */
	/*  First Render (Challenge-specific)           */
	/* -------------------------------------------- */

	/** @override */
	async _onFirstRender(context, options) {
		await super._onFirstRender(context, options);

		// Backfill stable IDs on legacy limits that don't have them
		const limitsNeedingIds = this.system.limits.filter((l) => !l.id);
		if (limitsNeedingIds.length && this.document.isOwner) {
			const limits = this.system.limits.map((l) =>
				l.id ? l : { ...l, id: foundry.utils.randomID() },
			);
			this.document.update({ "system.limits": limits });
		}
	}

	/* -------------------------------------------- */
	/*  Event Handlers & Actions                    */
	/* -------------------------------------------- */

	static async #onSubmitChallengeForm(_event, _form, formData) {
		const submitData = formData.object;

		await this._updateEmbeddedFromForm(submitData);

		// Notify story tags of effect changes
		this._notifyStoryTags();

		const limits = foundry.utils.getProperty(submitData, "system.limits");
		if (Array.isArray(limits)) {
			limits.forEach((limit) => {
				limit.max = Math.max(0, Math.trunc(Number(limit.max) || 0));
				if (limit.max > 0) {
					limit.value = Math.min(Math.max(0, limit.value), limit.max);
				} else {
					limit.value = 0;
				}
			});
		}

		// Normalize might entries if they exist
		const might = foundry.utils.getProperty(submitData, "system.might");
		if (Array.isArray(might)) {
			submitData["system.might"] = might.map((entry) => ({
				level: entry.level || "origin",
				description: entry.description || "",
			}));
		}

		await this.document.update(submitData);
	}

	static async #onAddLimit(_event, _target) {
		const limits = [
			...this.system.limits,
			{
				id: foundry.utils.randomID(),
				label: game.i18n.localize("LITM.Ui.new_limit"),
				outcome: "",
				max: 3,
				value: 0,
			},
		];
		await this.document.update({ "system.limits": limits });
	}

	static async #onRemoveLimit(_event, target) {
		if (!(await confirmDelete("LITM.Terms.limit"))) return;

		const index = Number(target.dataset.index);
		const limits = this.system.limits.filter((_, i) => i !== index);
		await this.document.update({ "system.limits": limits });
	}

	static async #onIncreaseLimit(_event, target) {
		const index = Number(target.dataset.index);
		const limit = this.system.limits[index];
		if (!limit || limit.max === 0) return;

		const limits = [...this.system.limits];
		limits[index] = {
			...limit,
			value: Math.min(limit.value + 1, limit.max),
		};
		await this.document.update({ "system.limits": limits });
	}

	static async #onDecreaseLimit(_event, target) {
		const index = Number(target.dataset.index);
		const limit = this.system.limits[index];
		if (!limit || limit.max === 0) return;

		const limits = [...this.system.limits];
		limits[index] = { ...limit, value: Math.max(limit.value - 1, 0) };
		await this.document.update({ "system.limits": limits });
	}

	static async #onAdjustRating(event, target) {
		event.preventDefault();
		event.stopPropagation();

		const button = target.closest("button");
		if (!button) return;

		const boxIndex = parseInt(button.dataset.index, 10);
		if (Number.isNaN(boxIndex)) return;

		const current = this.system.rating;
		const candidate = current === boxIndex + 1 ? boxIndex : boxIndex + 1;
		const next = Math.max(1, Math.min(5, candidate));
		await this.document.update({ "system.rating": next });
	}

	static async #onAddMight(_event, _target) {
		const might = [
			...(this.system.might || []),
			{ level: "origin", description: "" },
		];
		await this.document.update({ "system.might": might });
	}

	static async #onRemoveMight(_event, target) {
		const index = Number(target.dataset.index);
		const might = (this.system.might || []).filter((_, i) => i !== index);
		await this.document.update({ "system.might": might });
	}

	/* -------------------------------------------- */
	/*  Drag & Drop                                 */
	/* -------------------------------------------- */

	/** @override */
	async _onDropItem(event, item) {
		if (item.type !== "vignette") return;
		return super._onDropItem(event, item);
	}
}
