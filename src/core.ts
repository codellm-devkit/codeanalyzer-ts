import * as path from "node:path";
import { buildCallGraph } from "./semantic_analysis";
import { loadCache, saveCache } from "./utils";
import { buildCodeqlCallGraph, mergeEdges } from "./semantic_analysis";
import { materialize } from "./build";
import type { AnalysisOptions } from "./options";
import type { TSApplication } from "./schema";
import { buildSymbolTable } from "./syntactic_analysis";
import { Logger } from "./utils";

/**
 * The orchestrator. Order mirrors the reference analyzers: materialize deps → build the symbol
 * table → (level ≥ 2) build the resolver call graph → cache the base → return the Application.
 */
export function analyze(opts: AnalysisOptions): TSApplication {
  const log = new Logger(opts.verbosity);
  log.info(`analyzing ${opts.input} (level ${opts.analysisLevel})`);
  const cacheDir = opts.cacheDir ?? path.join(opts.input, ".codeanalyzer");

  const mat = materialize(opts, log);
  for (const note of mat.notes) log.debug(note);

  const cached = opts.eager ? null : loadCache(cacheDir);
  const { project, symbol_table } = buildSymbolTable(opts, mat, cached?.symbol_table ?? null, log);

  // Level 1: the tsc (ts-morph checker) resolver call graph + RTA + phantom external nodes.
  const cg = buildCallGraph(project, symbol_table, opts.input, log, opts.phantoms);
  let call_graph = cg.edges;
  // Level 2: enrich with CodeQL (merged by (source,target); stubbed for now).
  if (opts.analysisLevel >= 2) {
    call_graph = mergeEdges(call_graph, buildCodeqlCallGraph(opts, symbol_table, log));
  }

  const app: TSApplication = {
    symbol_table,
    call_graph,
    external_symbols: cg.external_symbols,
    entrypoints: {},
  };
  saveCache(cacheDir, { symbol_table, call_graph });
  return app;
}
