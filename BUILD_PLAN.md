# codeanalyzer-typescript — build plan

The CLDK TypeScript analyzer. Parses a TS/TSX project and emits the canonical CLDK
`analysis.json` (`{ symbol_table, call_graph, entrypoints }`) so the Python SDK can load it
via `CLDK(language="typescript").analysis(...)`.

## Tooling decisions (signed off)

```
depth:          rapid (level 1) — symbol table + resolver-based call graph; level 2 stubbed
runtime:        Node / Bun  (bun 1.3.14 at ~/.bun/bin; node v24.11.1)
structural:     ts-morph (TypeScript compiler API)  — ONE tool does structure + resolution
resolution:     ts-morph TypeChecker (same tool) — Tier 1, per-call-site
framework (L2): Joern jssrc2cpg / CodeQL — OFF by default, behind --framework; STUBBED for now
build/deps:     read tsconfig.json + package.json; ensure node_modules (cached under
                cache_dir). Materialized BEFORE parsing so the checker resolves types.
                Degrades to partial types on failure; --no-build skips materialization.
packaging:      `bun build --compile` → single self-contained binary `codeanalyzer-typescript`,
                version 0.1.0. The SDK invokes it as a subprocess and reads analysis.json
                from stdout (no -o) — mirrors the Java JAR pattern.
extra nodes:    interface, type-alias, enum  (decided in Schema Design, below)
```

### Why ts-morph (structural == resolver)

ts-morph wraps the TypeScript compiler API: one `Project`/`TypeChecker` gives us the parse
tree *and* resolves call targets, parameter/return types, and `extends`/`implements`. This is
the single most important fact for the build — step 5 (symbol table) and step 6 (call graph)
share one program, so the resolver call graph is genuinely cheap (the checker is already
loaded). It requires the target project's `tsconfig.json` + `node_modules` to be materialized
before parsing (handled in the materialization phase).

### Materialization timing

Because ts-morph's checker resolves types, deps are materialized **before** the symbol-table
build, so per-callable `parameter`/`return_type`/`receiver_type` fields are populated during
the structural pass (not deferred). Source-level resolution needs deps *present*, not a full
build — `npm install` / a prepared `node_modules` suffices.

## CLI surface (cli-contract.md)

`-i/--input` (required), `-o/--output` (omit ⇒ compact JSON to stdout — the SDK relies on
this), `-f/--format json|msgpack`, `-a/--analysis-level 1|2` (1 = symbol table only [default];
2 = + resolver call graph), `--framework` (heavy level-2 backend, off by default),
`-t/--target-files`, `--skip-tests/--include-tests`, `--eager/--lazy`, `--no-build`,
`-c/--cache-dir`, `-v`.

## Schema decisions

The invariant spine (`symbol_table: Dict[path, Module]`, identity-only `call_graph`,
`Module → Class/Callable` nesting, one `signatureOf()`) is mirrored from
`codeanalyzer-python`'s `py_schema.py`. TypeScript-specific decisions are recorded in
`SCHEMA_DECISIONS.md` (filled during the interactive Schema Design step).

## Analyzer ↔ SDK contract

The analyzer's `analysis.json` must validate against the SDK Pydantic models in
`python-sdk/cldk/models/typescript/models.py` (`TSApplication(**json.load(f))` must not raise),
with no dangling call-graph edges. Both sides are owned here and co-evolve.
