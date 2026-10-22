import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "src";
const bad = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full);
    } else if (/\.(ts|tsx|css|sql|mjs|json)$/.test(entry.name)) {
      const buffer = fs.readFileSync(full);
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        bad.push(full);
      }
    }
  }
}

walk(root);
console.log(bad.length ? bad.join("\n") : "all files are valid UTF-8");