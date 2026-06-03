import * as path from "node:path";
import { buildCallGraph } from "./callGraph";
import { loadCache, saveCache } from "./cache";
import { buildFrameworkCallGraph, mergeEdges } from "./framework";
import { materialize } from "./materialize";
import type { AnalysisOptions } from "./options";
import type { TSApplication, TSCallEdge } from "./schema";
import { buildSymbolTable } from "./symbolTable";
import { Logger } from "./util";

/**
 * The orchestrator. Order mirrors the reference analyzers: materialize deps → build the symbol
 * table → (level ≥ 2) build the resolver call graph → cache the base → return the Application.
 */
export function analyze(opts: AnalysisOptions): TSApplication {
  const log = new Logger(opts.verbosity);
  log.info(`analyzing ${opts.input} (level ${opts.analysisLevel}${opts.framework ? " + framework" : ""})`);
  const cacheDir = opts.cacheDir ?? path.join(opts.input, ".codeanalyzer");

  const mat = materialize(opts, log);
  for (const note of mat.notes) log.debug(note);

  const cached = opts.eager ? null : loadCache(cacheDir);
  const { project, symbol_table } = buildSymbolTable(opts, mat, cached?.symbol_table ?? null, log);

  let call_graph: TSCallEdge[] = [];
  if (opts.analysisLevel >= 2) {
    const tscEdges = buildCallGraph(project, symbol_table, opts.input, log);
    call_graph = opts.framework ? mergeEdges(tscEdges, buildFrameworkCallGraph(opts, log)) : tscEdges;
  }

  const app: TSApplication = { symbol_table, call_graph, entrypoints: {} };
  saveCache(cacheDir, { symbol_table, call_graph });
  return app;
}
