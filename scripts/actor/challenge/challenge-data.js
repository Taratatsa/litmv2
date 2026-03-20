export class ChallengeData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			category: new fields.StringField({
				initial: "",
			}),
			rating: new fields.NumberField({
				required: true,
				initial: 1,
				min: 1,
				max: 5,
			}),
			description: new fields.HTMLField({ initial: "" }),
			might: new fields.ArrayField(
				new fields.SchemaField({
					level: new fields.StringField({
						initial: "origin",
						choices: ["origin", "adventure", "greatness"],
					}),
					description: new fields.StringField({ initial: "" }),
				}),
			),
			specialFeatures: new fields.HTMLField({ initial: "" }),
			limits: new fields.ArrayField(
				new fields.SchemaField({
					id: new fields.StringField({
						initial: () => foundry.utils.randomID(),
					}),
					label: new fields.StringField({ initial: "" }),
					outcome: new fields.StringField({ initial: "" }),
					max: new fields.NumberField({ initial: 3, min: 0, integer: true }),
					value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
				}),
			),
			tags: new fields.StringField({
				initial: "",
			}),
		};
	}

	static migrateData(source) {
		if (Array.isArray(source.limits)) {
			for (const limit of source.limits) {
				if (typeof limit.max === "string") {
					const parsed = Number(limit.max);
					limit.max =
						Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
					if (limit.max === 0) limit.value = 0;
				}
			}
		}
		return super.migrateData(source);
	}

	get challenges() {
		return CONFIG.litmv2.challenge_types;
	}
}
