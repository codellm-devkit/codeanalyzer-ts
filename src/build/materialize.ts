import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisOptions } from "../options";
import type { Logger } from "../utils";

export interface Materialization {
  tsConfigFilePath: string | null;
  degraded: boolean;
  notes: string[];
}

/**
 * Materialize the target project's dependencies BEFORE parsing, so the ts-morph checker can
 * resolve types and call targets. This is the TypeScript analog of Java's
 * `downloadLibraryDependencies` and Python's `.venv` build — and, like them, it runs **by
 * default** (the analyzer is far more useful with deps present). `--no-build` opts out.
 *
 * Design choices that matter:
 * - **In-place `node_modules`.** Unlike Python's relocatable venv, Node's module resolution
 *   requires `node_modules` to live in the project tree, so we install there (and reuse it).
 * - **`--ignore-scripts`.** A source-level resolver needs the packages' `.d.ts`/JS *present*, not
 *   their native addons *compiled*. Skipping install scripts makes materialization fast and robust
 *   (projects with native deps like sqlite3 no longer fail the whole install).
 * - **Degrade, never crash.** If install fails (offline, broken dep), we log and continue with
 *   partial types — a symbol table with some unresolved types beats an exception.
 * - **`--eager` reinstalls**, mirroring Python recreating its venv.
 */
export function materialize(opts: AnalysisOptions, log: Logger): Materialization {
  const root = opts.input;
  const notes: string[] = [];
  let degraded = false;

  const tsconfig = findProjectConfig(root);
  notes.push(tsconfig ? `config: ${path.relative(root, tsconfig) || path.basename(tsconfig)}` : "no tsconfig/jsconfig — using default compiler options");

  const hasPkg = fs.existsSync(path.join(root, "package.json"));
  const hasNodeModules = fs.existsSync(path.join(root, "node_modules"));

  if (opts.noBuild) {
    notes.push("--no-build: skipping dependency materialization");
  } else if (!hasPkg) {
    notes.push("no package.json — nothing to materialize");
  } else if (hasNodeModules && !opts.eager) {
    notes.push("node_modules present — reused (pass --eager to reinstall)");
  } else {
    const inst = resolveInstaller(root);
    try {
      log.info(`materializing dependencies: ${inst.label}`);
      execFileSync(inst.bin, inst.args, {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        timeout: 600_000,
      });
      notes.push(`ran ${inst.label}`);
    } catch (e) {
      degraded = true;
      const msg = String((e as Error).message ?? e).slice(0, 160);
      notes.push(`dependency install failed — continuing with partial types (${msg})`);
      log.warn("dependency materialization failed; continuing with partial types");
    }
  }

  return { tsConfigFilePath: tsconfig, degraded, notes };
}

interface Installer {
  bin: string;
  args: string[];
  label: string;
}

/**
 * Pick the package manager from the lockfile (so we don't build a wrong tree), falling back to
 * npm when the preferred PM isn't installed. Always `--ignore-scripts` (types, not native builds).
 */
function resolveInstaller(root: string): Installer {
  const has = (f: string): boolean => fs.existsSync(path.join(root, f));
  const npmCommon = ["--ignore-scripts", "--no-audit", "--no-fund"];

  if (has("pnpm-lock.yaml") && binAvailable("pnpm")) {
    return { bin: "pnpm", args: ["install", "--ignore-scripts"], label: "pnpm install --ignore-scripts" };
  }
  if (has("yarn.lock") && binAvailable("yarn")) {
    return { bin: "yarn", args: ["install", "--ignore-scripts", "--silent"], label: "yarn install --ignore-scripts" };
  }
  if (has("package-lock.json")) {
    // npm ci is reproducible and lockfile-driven (it wipes/recreates node_modules).
    return { bin: "npm", args: ["ci", ...npmCommon], label: "npm ci --ignore-scripts" };
  }
  // No lockfile: install from package.json without writing a lockfile into the user's repo.
  return { bin: "npm", args: ["install", ...npmCommon, "--no-package-lock"], label: "npm install --ignore-scripts" };
}

function binAvailable(bin: string): boolean {
  try {
    execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** tsconfig.json → any tsconfig*.json → jsconfig.json (JS projects). */
function findProjectConfig(root: string): string | null {
  const direct = path.join(root, "tsconfig.json");
  if (fs.existsSync(direct)) return direct;
  try {
    const ts = fs.readdirSync(root).find((n) => /^tsconfig.*\.json$/.test(n));
    if (ts) return path.join(root, ts);
  } catch {
    /* unreadable dir */
  }
  const js = path.join(root, "jsconfig.json");
  return fs.existsSync(js) ? js : null;
}
