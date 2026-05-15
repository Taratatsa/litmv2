import fs from "node:fs";

// Usage: node scripts/lang-diff.js [--save] <reference.json> <check.json> [<check.json>...]
// Reports keys present in reference but missing from each check file.
// With --save, writes a <check>.missing.csv per check file containing the
// missing keys alongside their reference values.

const allArgs = process.argv.slice(2);
const save = allArgs.includes("--save");
const args = allArgs.filter((a) => a !== "--save");

if (args.length < 2) {
	console.error(
		"Usage: node scripts/lang-diff.js [--save] <reference.json> <check.json> [<check.json>...]",
	);
	process.exit(1);
}

const [referencePath, ...checkPaths] = args;
const reference = JSON.parse(fs.readFileSync(referencePath, "utf8"));

function collectKeys(obj, prefix = "") {
	return Object.entries(obj).flatMap(([k, v]) => {
		const key = prefix ? `${prefix}.${k}` : k;
		return v && typeof v === "object" && !Array.isArray(v)
			? collectKeys(v, key)
			: [key];
	});
}

function getValueByPath(obj, path) {
	return path
		.split(".")
		.reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

const refKeys = collectKeys(reference);
let totalMissing = 0;

for (const checkPath of checkPaths) {
	const data = JSON.parse(fs.readFileSync(checkPath, "utf8"));
	const checkKeys = new Set(collectKeys(data));
	const missing = refKeys.filter((k) => !checkKeys.has(k));

	console.log(`missing in ${checkPath}: ${missing.length}`);
	for (const k of missing) console.log(`- ${k}`);
	console.log();

	totalMissing += missing.length;

	if (save && missing.length) {
		const outPath = checkPath.replace(/\.json$/, "") + ".missing.csv";
		const csv = missing
			.map((key) => {
				const refValue = String(
					getValueByPath(reference, key) ?? "",
				).replaceAll(",", "\\,");
				return `${key},${refValue}`;
			})
			.join("\n");
		fs.writeFileSync(outPath, csv);
	}
}

if (totalMissing > 0) process.exitCode = 1;
