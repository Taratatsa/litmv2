/**
 * Shared +/- counter handler for SpendPowerApp and ApplyActionMenuApp. Walks
 * up to the nearest counter container (status-reduce row, spend-power counter,
 * or var-tier row), reads the displayed value, clamps it to [min, max] based
 * on the direction in `data-action`, and writes it back.
 *
 * Returns the new value so callers can drive follow-up updates (live cost
 * label, power readout, etc).
 *
 * @param {HTMLElement} target  The +/- button that was clicked.
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {number|null} The new value, or null if no counter could be resolved.
 */
export function adjustCounter(target, { min = 1, max = Infinity } = {}) {
	const container = target.closest(
		".litm-spend-power__counter, .litm-spend-power__status-reduce, .litm-spend-power__var-tier",
	);
	const valueEl = container?.querySelector(".litm-spend-power__counter-value");
	if (!valueEl) return null;

	const raw = Number(valueEl.textContent);
	const current = Number.isFinite(raw) ? raw : min;
	const next =
		target.dataset.action === "counter-inc"
			? Math.min(current + 1, max)
			: Math.max(min, current - 1);
	valueEl.textContent = next;
	return next;
}
