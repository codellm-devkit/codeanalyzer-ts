/**
 * Phantom (external) call resolution — WALA-style synthetic nodes for call targets outside the
 * project. When the tsc resolver can't map a call site to an in-project callable, we try to
 * attribute it to an imported / `require`d library member, producing a `TSExternalSymbol` and an
 * edge to it (provenance `import`). This is cheap: it reads the file's imports/requires, no type
 * checker and no `node_modules` needed, so it works identically for TS (`import`) and JS
 * (`require`). Only BARE specifiers (`express`, `node:fs`, `@scope/pkg`) become phantoms —
 * relative specifiers (`./x`, `../lib/y`) are internal and are left for the resolver, not faked.
 */
import { Node } from "ts-morph";

export interface ExternalIndex {
  /** local binding → external target, for bare calls `f()` and destructured/`require` members. */
  named: Map<string, { module: string; member?: string }>;
  /** local binding → module specifier, for member access `ns.method()` (namespace/default/require). */
  ns: Map<string, string>;
}

export interface PhantomTarget {
  module: string;
  member: string;
  signature: string;
}

/** A specifier is external iff it is not a relative/absolute path (so a bare package or `node:` URL). */
export function isExternalSpecifier(spec: string): boolean {
  return spec.length > 0 && !spec.startsWith(".") && !spec.startsWith("/");
}

/** Build the import/require binding index for one source file. */
export function buildExternalIndex(sf: Node): ExternalIndex {
  const named = new Map<string, { module: string; member?: string }>();
  const ns = new Map<string, string>();
  const s = sf as unknown as {
    getImportDeclarations?: () => Node[];
    getVariableDeclarations?: () => Node[];
  };

  // ES imports
  for (const imp of s.getImportDeclarations?.() ?? []) {
    const i = imp as unknown as {
      getModuleSpecifierValue: () => string;
      getDefaultImport?: () => { getText: () => string } | undefined;
      getNamespaceImport?: () => { getText: () => string } | undefined;
      getNamedImports?: () => Node[];
    };
    const m = i.getModuleSpecifierValue();
    if (!isExternalSpecifier(m)) continue;
    const def = i.getDefaultImport?.();
    if (def) {
      named.set(def.getText(), { module: m });
      ns.set(def.getText(), m);
    }
    const nsi = i.getNamespaceImport?.();
    if (nsi) ns.set(nsi.getText(), m);
    for (const ni of i.getNamedImports?.() ?? []) {
      const n = ni as unknown as { getName: () => string; getAliasNode?: () => { getText: () => string } | undefined };
      const local = n.getAliasNode?.()?.getText() ?? n.getName();
      named.set(local, { module: m, member: n.getName() });
    }
  }

  // CommonJS require: const x = require("m") | const {a,b} = require("m") | const y = require("m").z
  for (const vd of s.getVariableDeclarations?.() ?? []) {
    const v = vd as unknown as { getInitializer?: () => Node | undefined; getNameNode?: () => Node | undefined; getName: () => string };
    const init = v.getInitializer?.();
    if (!init) continue;
    const t = requireTarget(init);
    if (!t || !isExternalSpecifier(t.module)) continue;
    const nameNode = v.getNameNode?.();
    if (nameNode && Node.isObjectBindingPattern(nameNode)) {
      for (const el of nameNode.getElements()) {
        const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
        named.set(el.getName(), { module: t.module, member: propName });
      }
    } else {
      const local = v.getName();
      named.set(local, { module: t.module, member: t.member });
      if (!t.member) ns.set(local, t.module);
    }
  }
  return { named, ns };
}

/** Resolve a call/new expression to an external phantom target, or null. */
export function resolvePhantom(call: Node, idx: ExternalIndex): PhantomTarget | null {
  if (!Node.isCallExpression(call) && !Node.isNewExpression(call)) return null;
  const expr = call.getExpression();
  if (Node.isIdentifier(expr)) {
    const t = idx.named.get(expr.getText());
    if (t) return mk(t.module, t.member ?? expr.getText());
  } else if (Node.isPropertyAccessExpression(expr)) {
    const base = expr.getExpression();
    if (Node.isIdentifier(base)) {
      const mod = idx.ns.get(base.getText());
      if (mod) return mk(mod, expr.getName());
    } else {
      const m = requireModule(base); // require("m").method()
      if (m && isExternalSpecifier(m)) return mk(m, expr.getName());
    }
  }
  return null;
}

function mk(module: string, member: string): PhantomTarget {
  return { module, member, signature: `${module}.${member}` };
}

function requireModule(node: Node): string | null {
  if (!Node.isCallExpression(node)) return null;
  const e = node.getExpression();
  if (!Node.isIdentifier(e) || e.getText() !== "require") return null;
  const args = node.getArguments();
  if (!args.length) return null;
  const a = args[0];
  if (Node.isStringLiteral(a) || Node.isNoSubstitutionTemplateLiteral(a)) return a.getLiteralText();
  return null;
}

function requireTarget(init: Node): { module: string; member?: string } | null {
  const m = requireModule(init);
  if (m) return { module: m };
  if (Node.isPropertyAccessExpression(init)) {
    const base = requireModule(init.getExpression());
    if (base) return { module: base, member: init.getName() };
  }
  return null;
}
