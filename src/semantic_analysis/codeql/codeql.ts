/**
 * Level 2 — CodeQL enrichment. STUBBED but wired: at `-a 2` the level-1 tsc resolver call graph
 * is enriched with CodeQL-derived edges (the dynamic-dispatch / dataflow cases the checker can't
 * reach), merged by `(source, target)` with provenance union + weight accumulation.
 *
 * TODO(level-2/codeql): build a CodeQL JS/TS database for the project
 * (`codeql database create --language=javascript-typescript`, cached under cache_dir), run a
 * call-graph query, map each result row (caller/callee location) to a symbol-table signature via
 * the same `signatureOf()`, and return identity-only edges with provenance `["codeql"]`. Only
 * emit edges whose endpoints exist in the symbol table (preserve the no-dangling invariant).
 */
import type { AnalysisOptions } from "../../options";
import type { TSCallEdge, TSModule } from "../../schema";
import type { Logger } from "../../utils";

export function buildCodeqlCallGraph(
  _opts: AnalysisOptions,
  _symbol_table: Record<string, TSModule>,
  log: Logger,
): TSCallEdge[] {
  log.warn(
    "CodeQL enrichment (level 2, -a 2) is not implemented yet; emitting no extra edges. " +
      "TODO: build a CodeQL JS/TS database, run a call-graph query, map rows to signatures, and merge.",
  );
  return [];
}

/** Merge edge lists by (source,target): sum weights, union provenance, merge tags. */
export function mergeEdges(...lists: TSCallEdge[][]): TSCallEdge[] {
  const by = new Map<string, TSCallEdge>();
  for (const list of lists) {
    for (const e of list) {
      const k = `${e.source} ${e.target}`;
      const cur = by.get(k);
      if (cur) {
        cur.weight += e.weight;
        cur.provenance = [...new Set([...cur.provenance, ...e.provenance])].sort();
        cur.tags = { ...cur.tags, ...e.tags };
      } else {
        by.set(k, { ...e, provenance: [...e.provenance], tags: { ...e.tags } });
      }
    }
  }
  return [...by.values()];
}
