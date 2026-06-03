/**
 * Level 2 — framework-based (heavy) call graph. STUBBED but wired: gated behind --framework.
 *
 * TODO(level-2): integrate a CPG/IR backend — Joern `jssrc2cpg` or a CodeQL JS/TS pack — to
 * recover dynamic-dispatch / dataflow edges the Tier-1 checker can't reach, then merge them into
 * the resolver graph by (source, target) with provenance union (see `mergeEdges`). The cheap
 * level-1 path stays the default; this only runs when the user opts in.
 */
import type { AnalysisOptions } from "./options";
import type { TSCallEdge } from "./schema";
import type { Logger } from "./util";

export function buildFrameworkCallGraph(_opts: AnalysisOptions, log: Logger): TSCallEdge[] {
  log.warn(
    "--framework (level-2 framework-based analysis) is not implemented yet; emitting no edges. " +
      "TODO: integrate Joern jssrc2cpg / CodeQL and merge by (source,target).",
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
