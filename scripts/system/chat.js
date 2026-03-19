export const TRACK_ICONS = {
	promise: "fa-sun",
	improve: "fa-arrow-trend-up",
	milestone: "fa-mountain-sun",
	abandon: "fa-wind",
	limit: "fa-shield",
};

export const TRACK_LABEL_KEYS = {
	promise: "LITM.Ui.track_complete_promise",
	improve: "LITM.Ui.track_complete_improve",
	milestone: "LITM.Ui.track_complete_milestone",
	abandon: "LITM.Ui.track_complete_abandon",
	limit: "LITM.Ui.track_complete_limit",
};

export function buildTrackCompleteContent({ text, type, actorId, themeId }) {
	const esc = foundry.utils.escapeHTML;
	const icon = TRACK_ICONS[type];
	const label = game.i18n.localize(TRACK_LABEL_KEYS[type]);
	const footer =
		type === "improve" && actorId && themeId
			? `<footer class="litm-track-complete__footer">
				<button type="button" data-click="open-theme-advancement"
				        data-actor-id="${esc(actorId)}" data-theme-id="${esc(themeId)}">
					<i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("LITM.Ui.choose_improvement")}
				</button>
			</footer>`
			: "";
	return `<div class="litmv2 litm-track-complete litm-track-complete--${esc(type)}">
		<header class="litm-track-complete__header">
			<i class="fas ${icon}"></i>
			<span>${label}</span>
		</header>
		<p class="litm-track-complete__body"><strong>${esc(text)}</strong></p>
		${footer}
	</div>`;
}
