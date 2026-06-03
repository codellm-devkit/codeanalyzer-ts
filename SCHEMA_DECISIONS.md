# Schema decisions (codeanalyzer-typescript)

Auditable record of the node-by-node schema design. Anchored on the two mature reference
analyzers — Java (`python-sdk/cldk/models/java/models.py`, rich-edge legacy) and Python
(`codeanalyzer-python/codeanalyzer/schema/py_schema.py`, identity-only, the model we mirror).
Every divergence below was decided **with the user**.

## Invariant spine (never drifts)
- Root: `TSApplication { symbol_table: Dict[path, TSModule], call_graph: List[TSCallEdge],
  entrypoints: Dict[str, List[TSEntrypoint]] }`.
- `symbol_table` keyed by **project-relative POSIX path with extension** (e.g. `src/user.ts`).
- `Module → Class/Callable` nesting; identity-only edges (`source`/`target` are bare signature
  strings that byte-match a real `Callable.signature`).
- **One `signatureOf()`** produces every id, caller- and callee-side.

## Decisions

| # | Node / concept | Java | Python | **TS decision** | Rationale |
|---|---|---|---|---|---|
| 1 | **Signature scheme** | dotted FQN | `module.Class.method` (file-stem prefix, can collide) | **rel-path (no ext) + dotted members**: `src/services/user.UserService.getUser` | unique project-wide, file is recoverable from the id |
| 2 | **Constructor id** | `<init>` | `Class.__init__` | **`Class.constructor`** | matches the TS keyword; reads naturally |
| 3 | **interface / type-alias / enum** | one Class + `is_interface`/`is_enum` flags | none | **separate sibling collections** `interfaces{}`, `type_aliases{}`, `enums{}` on Module/Namespace, each a typed node with its own signature | first-class & queryable; `base_classes`/edges can reference them |
| 4 | **Decorators** | flat `annotations: List[str]` | structured `PyDecorator` | **structured `TSDecorator`** (name, qualified_name, positional_arguments[], keyword_arguments{}, span) | entrypoint finders read `@Get('/path')` without re-parsing |
| 5 | **Generics** | — | — | **structured `TSTypeParameter[]`** (`{name, constraint?, default?}`) on class/interface/callable/type-alias | faithful `<T extends Base = D>`; queryable |
| 6 | **extends / implements** | `extends_list` + `implements_list` | flat `base_classes` | **flat `base_classes` (spine) + typed `implements_types`** | `get_class_hierarchy` reads `base_classes`; split preserves class-vs-interface |
| 7 | **Member modifiers** | flat `modifiers: List[str]` | — | **typed fields**: `accessibility` (public\|private\|protected\|null), `is_static`, `is_abstract`, `is_async`, `is_generator`, `is_readonly`, `is_optional`, `accessor_kind` (getter\|setter\|null) | consumers branch on visibility/static directly |
| 8 | **Ambient / JSX / namespace / overloads** | — | — | **first-class**: `is_ambient` on declarations; `namespaces{}` collection (recursive, same containers as Module); `overload_signatures: List[TSOverloadSignature]` on the implementation callable; `is_tsx`/`is_declaration_file` on Module | the team wants these queryable, not buried in tags |

## Derived conventions
- **module prefix** = file key minus extension (`src/services/user`); also stored as
  `TSModule.module_name`.
- **scope chain**: namespace/class/function names are dot-joined onto the module prefix as we
  descend, so `namespace Api { class V1 {} }` in `src/api.ts` → `src/api.Api.V1`.
- **implicit constructors**: a class instantiated with `new` but lacking an explicit
  constructor still needs an edge target, so each class without an explicit constructor gets a
  synthesized `Class.constructor` callable (`is_implicit = true`) — mirrors Java's default
  constructor. Keeps the call graph free of dangling edges.
- **call-graph dispatch precision** (Tier-1): decided at the Call Graph Construction step.

## What stays open-vocabulary
`TSCallEdge.provenance` (`["tsc"]`, later `["tsc","joern"]`), `TSCallEdge.tags`,
`TSEntrypoint.tags` — plain strings/maps so a persisted `analysis.json` round-trips even
without the producing pass installed.
