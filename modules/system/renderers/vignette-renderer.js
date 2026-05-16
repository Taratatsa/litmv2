/**
 * Build the vignette-card fieldset shape. Used by both `renderVignette` and
 * the journey renderer's "general consequences" block, which is structurally
 * the same fieldset with a localized banner label and consequence-only data.
 *
 * Tags/statuses in threat and consequence text are left as raw text nodes
 * so the tag enricher (which runs after @render) processes them.
 *
 * @param {object} options
 * @param {string} options.label                   Banner label text
 * @param {string} [options.threat]                Threat description
 * @param {string[]} [options.consequences=[]]
 * @param {boolean} [options.isConsequenceOnly=false]
 * @returns {HTMLElement}
 */
export function vignetteCard({
	label,
	threat,
	consequences = [],
	isConsequenceOnly = false,
}) {
	const container = document.createElement("fieldset");
	container.classList.add("litm", "vignette-card", "litm-render");

	const legend = document.createElement("legend");
	legend.classList.add("litm-banner", "vignette-card-label");
	legend.textContent = label;
	container.appendChild(legend);

	if (!isConsequenceOnly && threat) {
		const div = document.createElement("div");
		div.classList.add("threat-text");
		div.textContent = threat;
		container.appendChild(div);
	}

	if (consequences.length) {
		const ul = document.createElement("ul");
		ul.classList.add("consequences-list");
		for (const c of consequences) {
			const li = document.createElement("li");
			li.classList.add("consequence-item");
			li.textContent = c;
			ul.appendChild(li);
		}
		container.appendChild(ul);
	}

	return container;
}

/**
 * Renders a Vignette item as an embed card, matching the challenge sheet style.
 * @param {Item} item - A vignette item document
 * @returns {HTMLElement}
 */
export function renderVignette(item) {
	const { threat, consequences, isConsequenceOnly } = item.system;
	return vignetteCard({
		label: item.name,
		threat,
		consequences,
		isConsequenceOnly,
	});
}
