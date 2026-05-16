import { sleep, localize as t } from "../utils.js";
import { createSampleHero } from "./sample-hero.js";
import { LitmSettings } from "./settings.js";

/**
 * Perform first-time world initialisation for a new GM session:
 * creates the default scene, generates a sample hero, and renames the
 * GM user to the localised "Narrator" display name.
 *
 * Safe to call multiple times — the {@link LitmSettings.welcomed} guard
 * (checked by the caller) prevents re-execution after the first run, and
 * the scene-name check inside provides an additional idempotency layer.
 */
export async function bootstrapWorldOnFirstLoad() {
	if (!game.user.isGM) return;

	const sceneName = game.i18n.localize("LITM.Name");
	const existingScene = game.scenes.getName(sceneName);
	if (existingScene) {
		await existingScene.activate();
		await createSampleHero();
		return;
	}

	const sceneData = {
		name: sceneName,
		ownership: { default: foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
		navigation: true,
		width: 1920,
		height: 1080,
		initial: { x: 1490, y: 839, scale: 0.7 },
		grid: { type: 0 },
		tokenVision: false,
		environment: { globalLight: { enabled: true } },
		background: {
			src: CONFIG.litmv2.assets.splash,
			color: "#000000",
		},
	};

	const levelId = foundry.documents.BaseScene.metadata.defaultLevelId;
	sceneData.fog = { mode: foundry.CONST.FOG_EXPLORATION_MODES.DISABLED };
	sceneData.levels = [
		{
			_id: levelId,
			name: sceneName,
			background: sceneData.background,
		},
	];
	sceneData.initialLevel = levelId;

	const scene = await foundry.documents.Scene.create(sceneData);

	const { thumb } = await scene.createThumbnail();
	await scene.update({ thumb });

	await sleep(300);
	await scene.activate();
	await sleep(300);

	await createSampleHero();

	// Set the GM's display name to "Narrator" (thematic default)
	if (game.user.name !== t("LITM.Terms.narrator")) {
		await game.user.update({ name: t("LITM.Terms.narrator") });
	}
}
