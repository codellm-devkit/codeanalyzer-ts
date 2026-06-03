import * as fs from "node:fs";
import * as path from "node:path";
import { relPosix } from "./util";

const SOURCE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".codeanalyzer",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "vendor",
]);

const TEST_DIRS = new Set(["__tests__", "__test__", "test", "tests", "spec", "__mocks__"]);

/** Test-ness is judged on the path RELATIVE TO the project root, never the absolute path. */
function isTestFile(relKey: string): boolean {
  const base = path.basename(relKey);
  if (/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(base)) return true;
  return relKey.split("/").some((p) => TEST_DIRS.has(p));
}

export interface DiscoveredFile {
  absPath: string;
  fileKey: string; // project-relative POSIX path with extension
}

/** Recursively discover .ts/.tsx sources under root, skipping vendored and (optionally) test trees. */
export function discoverSourceFiles(root: string, skipTests: boolean): DiscoveredFile[] {
  const out: DiscoveredFile[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (skipTests && TEST_DIRS.has(e.name)) continue;
        walk(abs);
      } else if (e.isFile()) {
        const ext = path.extname(e.name);
        if (!SOURCE_EXTS.has(ext)) continue;
        const fileKey = relPosix(root, abs);
        if (skipTests && isTestFile(fileKey)) continue;
        out.push({ absPath: abs, fileKey });
      }
    }
  };
  walk(root);
  out.sort((a, b) => a.fileKey.localeCompare(b.fileKey));
  return out;
}

/** Resolve a list of CLI target files (relative or absolute) to discovered files under root. */
export function resolveTargetFiles(root: string, targets: string[]): DiscoveredFile[] {
  const out: DiscoveredFile[] = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.resolve(root, t);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      out.push({ absPath: abs, fileKey: relPosix(root, abs) });
    }
  }
  out.sort((a, b) => a.fileKey.localeCompare(b.fileKey));
  return out;
}
