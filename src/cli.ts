import * as path from "node:path";
import { Command } from "commander";
import type { AnalysisOptions, OutputFormat } from "./options";

/** Parse argv (without node/script prefix) into normalized AnalysisOptions. See cli-contract.md. */
export function parseArgs(argv: string[]): AnalysisOptions {
  const program = new Command();
  program
    .name("codeanalyzer-typescript")
    .description("CLDK TypeScript analyzer — emits the canonical analysis.json (symbol table + resolver call graph).")
    .requiredOption("-i, --input <path>", "project root to analyze")
    .option("-o, --output <dir>", "output directory for analysis.json (omit ⇒ compact JSON to stdout)")
    .option("-f, --format <fmt>", "output format: json | msgpack", "json")
    .option("-a, --analysis-level <n>", "1 = symbol table only; 2 = + resolver call graph", "1")
    .option("--framework", "enable the heavy framework-based (level-2) call graph (stubbed)", false)
    .option("-t, --target-files <paths...>", "restrict analysis to specific files (incremental)")
    .option("--skip-tests", "skip test trees (default)")
    .option("--include-tests", "include test trees")
    .option("--eager", "force a clean rebuild instead of reusing the cache")
    .option("--lazy", "reuse the cache (default)")
    .option("--no-build", "skip dependency materialization (use a prepared node_modules)")
    .option("-c, --cache-dir <dir>", "cache/intermediate directory")
    .option("-v, --verbose", "increase verbosity (repeatable)", (_v: string, prev: number) => prev + 1, 0)
    .allowExcessArguments(true);

  program.parse(argv, { from: "user" });
  const o = program.opts();

  const level = String(o.analysisLevel) === "2" ? 2 : 1;
  const format: OutputFormat = o.format === "msgpack" ? "msgpack" : "json";
  const targets: string[] | null =
    Array.isArray(o.targetFiles) && o.targetFiles.length ? o.targetFiles.map(String) : null;

  return {
    input: path.resolve(String(o.input)),
    output: o.output ? path.resolve(String(o.output)) : null,
    format,
    analysisLevel: level,
    framework: Boolean(o.framework),
    targetFiles: targets,
    skipTests: o.includeTests ? false : true,
    eager: Boolean(o.eager),
    // commander maps --no-build to opts.build === false
    noBuild: o.build === false,
    cacheDir: o.cacheDir ? path.resolve(String(o.cacheDir)) : null,
    verbosity: typeof o.verbose === "number" ? o.verbose : 0,
  };
}
