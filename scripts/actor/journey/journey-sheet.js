import { LitmActorSheet } from "../../sheets/base-actor-sheet.js";
import { confirmDelete, enrichHTML } from "../../utils.js";

/**
 * Journey sheet for Legend in the Mist
 * Represents a sequence of vignettes with general consequences
 */
export class JourneySheet extends LitmActorSheet {
	/** @override */
	static DEFAULT_OPTIONS = {
		classes: ["litm", "litm-journey-sheet"],
		tag: "form",
		actions: {
			addVignette: JourneySheet.#onAddVignette,
			editVignette: JourneySheet.#onEditVignette,
			removeVignette: JourneySheet.#onRemoveVignette,
			clearGeneralConsequence: JourneySheet.#onClearGeneralConsequence,
		},
		form: {
			handler: LitmActorSheet._onSubmitActorForm,
			submitOnChange: true,
			closeOnSubmit: false,
		},
		window: {
			icon: "fa-solid fa-route",
			resizable: true,
		},
		dragDrop: [{ dropSelector: null }],
	};

	/** @override */
	static PARTS = {
		form: {
			template: "systems/litmv2/templates/actor/journey.html",
			scrollable: [""],
		},
	};

	/** @override */
	static _getEditModeTemplate() {
		return "systems/litmv2/templates/actor/journey.html";
	}

	/** @override */
	static _getPlayModeTemplate() {
		return "systems/litmv2/templates/actor/journey-play.html";
	}

	/**
	 * Flag to prevent hook feedback loops during effect sync.
	 * @type {boolean}
	 */
	_syncing = false;

	/* -------------------------------------------- */
	/*  Rendering                                   */
	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		const enrichedDescription = await enrichHTML(
			this.system.description,
			this.document,
		);

		const enrichedTags = await enrichHTML(
			this.system.tags || "",
			this.document,
		);

		// Prepare vignette items
		const generalConsequenceId = this.system.generalConsequences;
		const {
			vignettes,
			vignettesByType,
			excluded: generalConsequence,
		} = await this._prepareVignettes({ excludeId: generalConsequenceId });

		return {
			...context,
			isGM: game.user.isGM,
			isOwner: this.document.isOwner,
			isEditMode: this._isEditMode,
			enriched: {
				description: enrichedDescription,
				tags: enrichedTags,
			},
			tagsString: this.system.tags || "",
			tagTypeOptions: { tag: "LITM.Terms.tag", status: "LITM.Terms.status" },
			generalConsequenceId,
			generalConsequence,
			vignettes,
			vignettesByType,
			displayVignettes: vignettesByType.flatMap((g) => g.vignettes),
		};
	}

	/* -------------------------------------------- */
	/*  Tag String ↔ Effects                        */
	/* -------------------------------------------- */

	#effectsToTagString() {
		const effects = this.document.effects.filter(
			(e) => e.type === "story_tag" || e.type === "status_card",
		);
		return effects
			.map((e) => {
				if (e.type === "status_card") {
					const tier = e.system?.currentTier ?? 0;
					return `[${e.name}-${tier}]`;
				}
				return `[${e.name}]`;
			})
			.join(" ");
	}

	async #syncEffectsFromString(tagsString) {
		const matches = Array.from(tagsString.matchAll(CONFIG.litmv2.tagStringRe));
		const parsed = matches.map(([_, name, separator, value]) => ({
			name,
			isStatus: separator === "-",
			tier: Number.parseInt(value, 10) || 0,
		}));

		const toDelete = this.document.effects
			.filter((e) => e.type === "story_tag" || e.type === "status_card")
			.map((e) => e.id);

		if (toDelete.length) {
			await this.document.deleteEmbeddedDocuments("ActiveEffect", toDelete);
		}

		if (parsed.length) {
			await this.document.createEmbeddedDocuments(
				"ActiveEffect",
				parsed.map((t) => ({
					name: t.name,
					type: t.isStatus ? "status_card" : "story_tag",
					system: t.isStatus
						? {
								tiers: Array(6)
									.fill(false)
									.map((_, i) => i + 1 === t.tier),
							}
						: { isScratched: false, isSingleUse: false },
				})),
			);
		}

		this._notifyStoryTags();
	}

	/* -------------------------------------------- */
	/*  External Effect Hooks                       */
	/* -------------------------------------------- */

	/**
	 * Ensure tags string and ActiveEffect documents are in sync on first render.
	 * @private
	 */
	async #syncTagsAndEffects() {
		if (!this.system.tags) {
			const tagString = this.#effectsToTagString();
			if (tagString) {
				await this.document.update({ "system.tags": tagString });
			}
		}

		if (this.system.tags?.length && !this._syncing) {
			const hasEffects = this.document.effects.some(
				(e) => e.type === "story_tag" || e.type === "status_card",
			);
			if (!hasEffects) {
				this._syncing = true;
				await this.#syncEffectsFromString(this.system.tags);
				this._syncing = false;
			}
		}
	}

	/** @override */
	async _onFirstRender(context, options) {
		await super._onFirstRender(context, options);
		if (this.document.isOwner) {
			this.#syncTagsAndEffects().catch((err) =>
				console.error("litm | Failed to sync journey tags/effects", err),
			);
		}
		this._hookIds = {
			create: Hooks.on("createActiveEffect", (effect) => {
				if (effect.parent !== this.document) return;
				if (this._syncing) return;
				if (!this.document.isOwner) return;
				if (effect.type !== "story_tag" && effect.type !== "status_card")
					return;
				const tag =
					effect.type === "status_card"
						? `[${effect.name}-${effect.system?.currentTier ?? 1}]`
						: `[${effect.name}]`;
				const current = this.system.tags || "";
				const separator = current.length ? " " : "";
				this.document.update({
					"system.tags": current + separator + tag,
				});
			}),
			update: Hooks.on("updateActiveEffect", (effect) => {
				if (effect.parent !== this.document) return;
				if (this._syncing) return;
				if (!this.document.isOwner) return;
				if (effect.type !== "status_card") return;
				const name = effect.name;
				const newTier = effect.system?.currentTier ?? 0;
				let tags = this.system.tags || "";
				const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const re = new RegExp(`([\\[{]${escaped})[\\s\\-:](\\d+)([\\]}])`, "i");
				if (re.test(tags)) {
					tags = tags.replace(re, `$1-${newTier}$3`);
					this.document.update({ "system.tags": tags });
				}
			}),
			delete: Hooks.on("deleteActiveEffect", (effect) => {
				if (effect.parent !== this.document) return;
				if (this._syncing) return;
				if (!this.document.isOwner) return;
				if (effect.type !== "story_tag" && effect.type !== "status_card")
					return;
				const name = effect.name;
				const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				let tags = this.system.tags || "";
				const re = new RegExp(`[\\[{]${escaped}(?:[\\s\\-:]\\d+)?[\\]}]`, "gi");
				tags = tags.replace(re, "").trim();
				tags = tags
					.replace(/,\s*,/g, ",")
					.replace(/^\s*,|,\s*$/g, "")
					.trim();
				this.document.update({ "system.tags": tags });
			}),
		};
	}

	/** @override */
	_onClose(options) {
		if (this._hookIds) {
			Hooks.off("createActiveEffect", this._hookIds.create);
			Hooks.off("updateActiveEffect", this._hookIds.update);
			Hooks.off("deleteActiveEffect", this._hookIds.delete);
		}
		return super._onClose(options);
	}

	/* -------------------------------------------- */
	/*  Mode Switching                              */
	/* -------------------------------------------- */

	/** @override */
	async _onChangeSheetMode(_event, _target) {
		const wasEditMode = this._isEditMode;
		if (wasEditMode) {
			await this.submit();
			this._syncing = true;
			await this.#syncEffectsFromString(this.system.tags ?? "");
			this._syncing = false;
		}
		this._mode = this._isEditMode
			? this.constructor.MODES.PLAY
			: this.constructor.MODES.EDIT;
		return this.render(true);
	}

	/* -------------------------------------------- */
	/*  Event Handlers & Actions                    */
	/* -------------------------------------------- */

	static async #onAddVignette(_event, _target) {
		const [vignette] = await this.document.createEmbeddedDocuments("Item", [
			{ name: game.i18n.localize("LITM.Ui.new_vignette"), type: "vignette" },
		]);
		vignette.sheet.render(true);
	}

	static async #onRemoveVignette(_event, target) {
		if (!(await confirmDelete("TYPES.Item.vignette"))) return;

		const itemId = target.dataset.itemId;
		const item = this.document.items.get(itemId);
		await item?.delete();
	}

	static #onEditVignette(_event, target) {
		const itemId = target.dataset.itemId;
		const item = this.document.items.get(itemId);
		item?.sheet.render(true);
	}

	static async #onClearGeneralConsequence(_event, _target) {
		await this.document.update({ "system.generalConsequences": "" });
	}

	/* -------------------------------------------- */
	/*  Drag & Drop                                 */
	/* -------------------------------------------- */

	/** @override */
	async _onDropItem(event, item) {
		if (item.type !== "vignette") return;

		const dropZone = event.target?.closest?.("[data-drop-zone]");
		if (dropZone?.dataset?.dropZone === "general-consequences") {
			let vignetteId = null;
			const isOnThisJourney = item.parent?.id === this.document.id;

			if (isOnThisJourney) {
				vignetteId = item.id;
			} else {
				const itemData = item.toObject();
				delete itemData._id;
				const [created] = await this.document.createEmbeddedDocuments("Item", [
					itemData,
				]);
				vignetteId = created?.id;
			}

			if (!vignetteId) return;

			const existingId = this.system.generalConsequences;
			if (existingId && existingId !== vignetteId) {
				const shouldReplace = await foundry.applications.api.DialogV2.confirm({
					window: {
						title: game.i18n.localize(
							"LITM.Ui.replace_general_consequence_title",
						),
					},
					content: game.i18n.localize(
						"LITM.Ui.replace_general_consequence_content",
					),
					no: { default: true },
					classes: ["litm"],
				});
				if (!shouldReplace) return;
			}

			await this.document.update({
				"system.generalConsequences": vignetteId,
			});
			return;
		}

		return super._onDropItem(event, item);
	}
}
