import { existsSync, readdirSync, readFileSync } from "node:fs";

const DIR = process.argv[2] ?? "n8n/workflows";
const ALLOWED_KEYS = new Set([
  "id",
  "name",
  "active",
  "nodes",
  "connections",
  "settings",
]);
const problems = [];

const knownSecrets = existsSync("n8n/.env")
  ? readFileSync("n8n/.env", "utf8")
      .split("\n")
      .map((line) => line.slice(line.indexOf("=") + 1).trim())
      .filter((value) => value.length >= 16)
  : [];

const SECRET_SHAPES = [
  [/\b[0-9a-f]{40,}\b/i, "a long hex string"],
  [/\b(sk|pk)_(live|test)_[A-Za-z0-9]{10,}/, "an API key"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "a JWT"],
];

const files = readdirSync(DIR).filter((file) => file.endsWith(".json"));
for (const file of files) {
  const text = readFileSync(`${DIR}/${file}`, "utf8");
  const workflow = JSON.parse(text);
  for (const key of Object.keys(workflow)) {
    if (!ALLOWED_KEYS.has(key))
      problems.push(`${file}: holds instance data under "${key}"`);
  }
  for (const value of knownSecrets) {
    if (text.includes(value))
      problems.push(`${file}: contains a value from n8n/.env`);
  }
  for (const [pattern, label] of SECRET_SHAPES) {
    if (pattern.test(text)) problems.push(`${file}: contains ${label}`);
  }
  // A credential reference names a stored credential and holds no secret.
  for (const node of workflow.nodes ?? []) {
    for (const reference of Object.values(node.credentials ?? {})) {
      const keys = Object.keys(reference).sort().join();
      if (keys !== "id,name")
        problems.push(`${file}: node "${node.name}" embeds credential data`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`n8n exports are clean (${files.length} files checked).`);
