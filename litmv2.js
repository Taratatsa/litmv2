import { ChallengeData } from "./modules/actor/challenge/challenge-data.js";
import { ChallengeSheet } from "./modules/actor/challenge/challenge-sheet.js";
import { FellowshipData } from "./modules/actor/fellowship/fellowship-data.js";
import { FellowshipSheet } from "./modules/actor/fellowship/fellowship-sheet.js";
import { HeroData } from "./modules/actor/hero/hero-data.js";
import { HeroSheet } from "./modules/actor/hero/hero-sheet.js";
import { JourneyData } from "./modules/actor/journey/journey-data.js";
import { JourneySheet } from "./modules/actor/journey/journey-sheet.js";
import { StoryThemeActorData } from "./modules/actor/story-theme/story-theme-actor-data.js";
import { StoryThemeActorSheet } from "./modules/actor/story-theme/story-theme-actor-sheet.js";
import { ApplyActionMenuApp } from "./modules/apps/apply-action-menu.js";
import { DoubleSix } from "./modules/apps/dice.js";
import { LitmRoll } from "./modules/apps/roll.js";
import { LitmRollDialog } from "./modules/apps/roll-dialog.js";
import { SpendPowerApp } from "./modules/apps/spend-power.js";
import { StoryTagSidebar } from "./modules/apps/story-tag-sidebar.js";
import { ThemeAdvancementApp } from "./modules/apps/theme-advancement.js";
import { WelcomeOverlay } from "./modules/apps/welcome-overlay.js";
import { SuperCheckbox } from "./modules/components/super-checkbox.js";
import { LitmActiveEffectSheet } from "./modules/data/active-effects/active-effect-sheet.js";
import {
	FellowshipTagData,
	PowerTagData,
	RelationshipTagData,
	StatusTagData,
	StoryTagData,
	WeaknessTagData,
} from "./modules/data/active-effects/index.js";
import { LitmActiveEffect } from "./modules/data/active-effects/litm-active-effect.js";
import { LitmTokenHUD } from "./modules/hud/litm-token-hud.js";
import { ActionData } from "./modules/item/action/action-data.js";
import { ActionSheet } from "./modules/item/action/action-sheet.js";
import { AddonData } from "./modules/item/addon/addon-data.js";
import { AddonSheet } from "./modules/item/addon/addon-sheet.js";
import { BackpackData } from "./modules/item/backpack/backpack-data.js";
import { BackpackSheet } from "./modules/item/backpack/backpack-sheet.js";
import { LitmItem } from "./modules/item/litm-item.js";
import { StoryThemeData } from "./modules/item/story-theme/story-theme-data.js";
import { StoryThemeSheet } from "./modules/item/story-theme/story-theme-sheet.js";
import { ThemeData } from "./modules/item/theme/theme-data.js";
import { ThemeSheet } from "./modules/item/theme/theme-sheet.js";
import { ThemebookData } from "./modules/item/themebook/themebook-data.js";
import { ThemebookSheet } from "./modules/item/themebook/themebook-sheet.js";
import { TropeData } from "./modules/item/trope/trope-data.js";
import { TropeSheet } from "./modules/item/trope/trope-sheet.js";
import { VignetteData } from "./modules/item/vignette/vignette-data.js";
import { VignetteSheet } from "./modules/item/vignette/vignette-sheet.js";
import { info, success } from "./modules/logger.js";
import {
	ChallengeSheetLandscape,
	FellowshipSheetLandscape,
	HeroSheetLandscape,
	JourneySheetLandscape,
} from "./modules/sheets/landscape-sheets.js";
import { LitmConfig } from "./modules/system/config.js";
import { ContentSources } from "./modules/system/content-sources.js";
import { Enrichers } from "./modules/system/enrichers.js";
import { Fonts } from "./modules/system/fonts.js";
import {
	HandlebarsHelpers,
	HandlebarsPartials,
} from "./modules/system/handlebars.js";
import { LitmHooks } from "./modules/system/hooks/index.js";
import { loadStatusCompendium } from "./modules/system/hooks/token-hooks.js";
import { KeyBindings } from "./modules/system/keybindings.js";
import { migrateWorld } from "./modules/system/migrations.js";
import { LitmSettings } from "./modules/system/settings.js";
import { Sockets } from "./modules/system/sockets.js";

// Register Custom Elements
SuperCheckbox.Register();

// Init Hook
Hooks.once("init", () => {
	info("Initializing Legend in the Mist...");
	game.litmv2 = {
		data: {
			PowerTagData,
			WeaknessTagData,
			FellowshipTagData,
			RelationshipTagData,
			StoryTagData,
			StatusTagData,
		},
		methods: {
			// Kept for backward compat with external modules; prefer importing LitmRoll.calculatePower directly.
			calculatePower: LitmRoll.calculatePower,
		},
		get fellowship() {
			if (!LitmSettings.useFellowship) return null;
			const id = LitmSettings.fellowshipId;
			return id ? (game.actors?.get(id) ?? null) : null;
		},
		LitmRollDialog,
		LitmRoll,
		WelcomeOverlay,
		StoryTagApp: StoryTagSidebar,
		SpendPowerApp,
		ApplyActionMenuApp,
		ThemeAdvancementApp,
		rollDialogHud: null,
		ContentSources,
	};

	info("Initializing Config...");
	CONFIG.Actor.dataModels.hero = HeroData;
	CONFIG.Actor.dataModels.challenge = ChallengeData;
	CONFIG.Actor.dataModels.journey = JourneyData;
	CONFIG.Actor.dataModels.fellowship = FellowshipData;
	CONFIG.Actor.dataModels.story_theme = StoryThemeActorData;
	CONFIG.Actor.trackableAttributes.hero = HeroData.getTrackableAttributes();
	LitmSettings.register();
	DoubleSix.register();
	CONFIG.Dice.rolls.push(LitmRoll);
	CONFIG.Item.documentClass = LitmItem;
	CONFIG.ActiveEffect.documentClass = LitmActiveEffect;
	CONFIG.Item.dataModels.backpack = BackpackData;
	CONFIG.Item.dataModels.theme = ThemeData;
	CONFIG.Item.dataModels.themebook = ThemebookData;
	CONFIG.Item.dataModels.vignette = VignetteData;
	CONFIG.Item.dataModels.addon = AddonData;
	CONFIG.Item.dataModels.story_theme = StoryThemeData;
	CONFIG.Item.dataModels.trope = TropeData;
	CONFIG.Item.dataModels.action = ActionData;
	CONFIG.ActiveEffect.dataModels.power_tag = PowerTagData;
	CONFIG.ActiveEffect.dataModels.weakness_tag = WeaknessTagData;
	CONFIG.ActiveEffect.dataModels.fellowship_tag = FellowshipTagData;
	CONFIG.ActiveEffect.dataModels.relationship_tag = RelationshipTagData;
	CONFIG.ActiveEffect.dataModels.story_tag = StoryTagData;
	CONFIG.ActiveEffect.dataModels.status_tag = StatusTagData;
	CONFIG.ActiveEffect.typeLabels = {
		power_tag: "TYPES.ActiveEffect.power_tag",
		weakness_tag: "TYPES.ActiveEffect.weakness_tag",
		fellowship_tag: "TYPES.ActiveEffect.fellowship_tag",
		relationship_tag: "TYPES.ActiveEffect.relationship_tag",
		story_tag: "TYPES.ActiveEffect.story_tag",
		status_tag: "TYPES.ActiveEffect.status_tag",
	};
	CONFIG.litmv2 = LitmConfig;
	CONFIG.Token.hudClass = LitmTokenHUD;

	StoryTagSidebar.registerSidebarTab();

	info("Registering Sheets...");
	// Unregister the default sheets
	foundry.documents.collections.Actors.unregisterSheet(
		"core",
		foundry.appv1.sheets.ActorSheet,
	);
	foundry.documents.collections.Items.unregisterSheet(
		"core",
		foundry.appv1.sheets.ItemSheet,
	);
	// Register the sheets
	foundry.documents.collections.Actors.registerSheet("litmv2", HeroSheet, {
		types: ["hero"],
		makeDefault: true,
		label: "LITM.Sheets.hero",
	});
	foundry.documents.collections.Actors.registerSheet("litmv2", ChallengeSheet, {
		types: ["challenge"],
		makeDefault: true,
		label: "LITM.Sheets.challenge",
	});
	foundry.documents.collections.Actors.registerSheet("litmv2", JourneySheet, {
		types: ["journey"],
		makeDefault: true,
		label: "LITM.Sheets.journey",
	});
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		FellowshipSheet,
		{
			types: ["fellowship"],
			makeDefault: true,
			label: "LITM.Sheets.fellowship",
		},
	);
	// Landscape variants
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		HeroSheetLandscape,
		{
			types: ["hero"],
			makeDefault: false,
			label: "LITM.Sheets.hero_landscape",
		},
	);
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		ChallengeSheetLandscape,
		{
			types: ["challenge"],
			makeDefault: false,
			label: "LITM.Sheets.challenge_landscape",
		},
	);
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		JourneySheetLandscape,
		{
			types: ["journey"],
			makeDefault: false,
			label: "LITM.Sheets.journey_landscape",
		},
	);
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		FellowshipSheetLandscape,
		{
			types: ["fellowship"],
			makeDefault: false,
			label: "LITM.Sheets.fellowship_landscape",
		},
	);
	foundry.documents.collections.Actors.registerSheet(
		"litmv2",
		StoryThemeActorSheet,
		{
			types: ["story_theme"],
			makeDefault: true,
			label: "LITM.Sheets.story_theme",
		},
	);
	foundry.documents.collections.Items.registerSheet("litmv2", BackpackSheet, {
		types: ["backpack"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", ThemeSheet, {
		types: ["theme"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", ThemebookSheet, {
		types: ["themebook"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", VignetteSheet, {
		types: ["vignette"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", AddonSheet, {
		types: ["addon"],
		makeDefault: true,
		label: "LITM.Sheets.addon",
	});
	foundry.documents.collections.Items.registerSheet("litmv2", StoryThemeSheet, {
		types: ["story_theme"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", TropeSheet, {
		types: ["trope"],
		makeDefault: true,
	});
	foundry.documents.collections.Items.registerSheet("litmv2", ActionSheet, {
		types: ["action"],
		makeDefault: true,
		label: "LITM.Sheets.action",
	});
	LitmActiveEffectSheet.register();

	HandlebarsHelpers.register();
	HandlebarsPartials.register();
	Fonts.register();
	KeyBindings.register();
	LitmHooks.register();
});

// i18nInit Hook — needs localized strings
Hooks.once("i18nInit", () => {
	Enrichers.register();
});

// Ready Hook — needs game world + socket
Hooks.once("ready", async () => {
	await migrateWorld();
	await ContentSources.seedStatuses();
	await loadStatusCompendium();

	Sockets.registerListeners();

	// Alias game.litmv2.storyTags to the sidebar tab instance
	game.litmv2.storyTags = ui.combat;

	success("Successfully initialized Legend in the Mist!");
});
