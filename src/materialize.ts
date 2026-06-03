import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisOptions } from "./options";
import type { Logger } from "./util";

export interface Materialization {
  tsConfigFilePath: string | null;
  degraded: boolean;
  notes: string[];
}

/**
 * Materialize the target project's dependencies BEFORE parsing, so the ts-morph checker resolves
 * types and call targets. Mirrors Java's `downloadLibraryDependencies` / Python's venv build.
 * Idempotent, cached in-place (node_modules), and degrades to partial types rather than crashing.
 */
export function materialize(opts: AnalysisOptions, log: Logger): Materialization {
  const root = opts.input;
  const notes: string[] = [];
  let degraded = false;

  const tsconfig = findTsConfig(root);
  notes.push(tsconfig ? `tsconfig: ${path.relative(root, tsconfig) || "tsconfig.json"}` : "no tsconfig.json — using default compiler options");

  const hasPkg = fs.existsSync(path.join(root, "package.json"));
  const hasNodeModules = fs.existsSync(path.join(root, "node_modules"));

  if (opts.noBuild) {
    notes.push("--no-build: skipping dependency materialization");
  } else if (hasPkg && !hasNodeModules) {
    try {
      const hasLock = fs.existsSync(path.join(root, "package-lock.json"));
      const sub = hasLock ? "ci" : "install";
      log.info(`materializing dependencies: npm ${sub}`);
      execFileSync("npm", [sub, "--no-audit", "--no-fund", "--silent"], {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        timeout: 300_000,
      });
      notes.push(`ran npm ${sub}`);
    } catch (e) {
      degraded = true;
      const msg = String((e as Error).message ?? e).slice(0, 160);
      notes.push(`dependency install failed — continuing with partial types (${msg})`);
      log.warn("dependency materialization failed; continuing with partial types");
    }
  } else if (hasNodeModules) {
    notes.push("node_modules present — reused");
  } else {
    notes.push("no package.json — nothing to materialize");
  }

  return { tsConfigFilePath: tsconfig, degraded, notes };
}

function findTsConfig(root: string): string | null {
  const direct = path.join(root, "tsconfig.json");
  if (fs.existsSync(direct)) return direct;
  try {
    const f = fs.readdirSync(root).find((n) => /^tsconfig.*\.json$/.test(n));
    return f ? path.join(root, f) : null;
  } catch {
    return null;
  }
}
