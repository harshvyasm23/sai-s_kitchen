// Patches every installed copy of @ai-sdk/provider-utils so Metro can bundle it.
//
// The package contains a dynamic `import(id)` in `importNodeModule` that Metro
// cannot statically analyze, failing the build with
// "Invalid call at line 410: import(id)". This script rewrites that call into a
// safe runtime rejection — functionally identical in React Native, where the
// Node-only code path could never work anyway.
//
// Runs automatically via the `postinstall` npm script and is idempotent.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const marker = "[Rork] Dynamic import";
const replacement =
  'return Promise.reject(new Error("' + marker + ' of node modules is not supported in React Native: " + id));';

const dynamicImportPattern = /\breturn\s+import\(id\)\s*;/;

const patchedFiles = [];

function walk(dir, depth) {
  if (depth > 8) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (entry === "@ai-sdk") {
        const providerUtils = join(fullPath, "provider-utils", "dist");
        for (const file of ["index.mjs", "index.js"]) {
          const target = join(providerUtils, file);
          if (!existsSync(target)) continue;
          const source = readFileSync(target, "utf8");
          if (!dynamicImportPattern.test(source) || source.includes(marker)) continue;
          writeFileSync(target, source.replace(dynamicImportPattern, replacement));
          patchedFiles.push(target);
        }
      }
      walk(fullPath, depth + 1);
    }
  }
}

const nodeModules = join(root, "node_modules");
if (existsSync(nodeModules)) {
  walk(nodeModules, 0);
}

if (patchedFiles.length > 0) {
  console.log(`[patch-ai-sdk] Patched ${patchedFiles.length} file(s):`);
  for (const file of patchedFiles) console.log(`  - ${file}`);
} else {
  console.log("[patch-ai-sdk] No @ai-sdk/provider-utils dynamic imports needed patching.");
}
