import { localize as t, titleCase } from "../../utils.js";

export class StoryThemeData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		const abstract = game.litmv2.data;
		return {
			isScratched: new fields.BooleanField(),
			description: new fields.HTMLField({
				initial: "",
			}),
			level: new fields.StringField({
				trim: true,
				initial: () => Object.keys(CONFIG.litmv2.theme_levels)[0],
				validate: (level) =>
					Object.keys(CONFIG.litmv2.theme_levels).includes(level),
			}),
			theme: new fields.SchemaField({
				powerTags: new fields.ArrayField(
					new fields.EmbeddedDataField(abstract.TagData),
					{
						initial: () => [
							{
								id: foundry.utils.randomID(),
								name: "",
								type: "powerTag",
								isActive: true,
								isScratched: false,
							},
							{
								id: foundry.utils.randomID(),
								name: "",
								type: "powerTag",
								isActive: true,
								isScratched: false,
							},
						],
					},
				),
				weaknessTags: new fields.ArrayField(
					new fields.EmbeddedDataField(abstract.TagData),
					{
						initial: () => [
							{
								id: foundry.utils.randomID(),
								name: "",
								type: "weaknessTag",
								isActive: true,
								isScratched: false,
							},
						],
					},
				),
			}),
		};
	}

	static migrateData(source) {
		// Move level from theme.level to top-level level
		if (source.theme?.level) {
			source.level ??= source.theme.level;
			delete source.theme.level;
		}
		// Migrate invalid "story" level to first valid level
		const validLevels = Object.keys(CONFIG.litmv2?.theme_levels ?? {});
		if (validLevels.length && !validLevels.includes(source.level)) {
			source.level = validLevels[0];
		}
		for (const tag of source.theme?.powerTags ?? []) {
			if (!tag.id) tag.id = foundry.utils.randomID();
		}
		for (const tag of source.theme?.weaknessTags ?? []) {
			if (!tag.id) tag.id = foundry.utils.randomID();
		}
		return super.migrateData(source);
	}

	prepareDerivedData() {
		for (const tag of this.theme.weaknessTags) {
			tag.isScratched = false;
		}
	}

	get themeTag() {
		const item = {
			id: this.parent._id,
			name: titleCase(this.parent.name),
			isActive: true,
			isScratched: this.isScratched ?? false,
			type: "themeTag",
		};
		return game.litmv2.data.TagData.fromSource(item);
	}

	get levelIcon() {
		return `systems/litmv2/assets/media/icons/${this.level}.svg`;
	}

	get levels() {
		const levels = CONFIG.litmv2.theme_levels || {};
		return Object.keys(levels).reduce((acc, level) => {
			acc[level] = t(`LITM.Terms.${level}`);
			return acc;
		}, {});
	}

	get powerTags() {
		return this.theme.powerTags;
	}

	get weaknessTags() {
		return this.theme.weaknessTags;
	}

	get weakness() {
		return this.weaknessTags;
	}

	get allTags() {
		return [...this.weaknessTags, ...this.powerTags, this.themeTag];
	}

	get availablePowerTags() {
		return [...this.powerTags, this.themeTag].filter(
			(tag) => tag.isActive && !tag.isScratched,
		);
	}
}
