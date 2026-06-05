/**
 * signatureOf — THE canonicalizer. One function computes a declaration's signature by walking
 * its scope-contributing ancestors, so the caller-side id (assigned during symbol-table build)
 * and the callee-side id (computed during call-graph resolution) are byte-identical. Edges can
 * therefore only ever reference signatures that exist in the symbol table.
 */
import { Node } from "ts-morph";
import { fileKeyOf, signatureOf, constructorSignatureOf } from "./schema";

/** The name a node contributes to a signature's dotted member chain, or null if it contributes none. */
export function contributorName(node: Node): string | null {
  if (Node.isClassDeclaration(node) || Node.isClassExpression(node)) return classLikeName(node);
  if (Node.isInterfaceDeclaration(node)) return node.getName();
  if (Node.isEnumDeclaration(node)) return node.getName();
  if (Node.isTypeAliasDeclaration(node)) return node.getName();
  if (Node.isModuleDeclaration(node)) return node.getName(); // namespace
  if (Node.isFunctionDeclaration(node)) return funcLikeName(node);
  if (Node.isMethodDeclaration(node) || Node.isMethodSignature(node)) return safeName(node);
  if (Node.isGetAccessorDeclaration(node) || Node.isSetAccessorDeclaration(node)) return safeName(node);
  if (Node.isConstructorDeclaration(node)) return "constructor";
  if (Node.isVariableDeclaration(node)) {
    const init = node.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return node.getName();
    return null;
  }
  return null;
}

export function isCallableDecl(node: Node): boolean {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isConstructorDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isMethodSignature(node) ||
    Node.isFunctionExpression(node) ||
    Node.isArrowFunction(node)
  );
}

/**
 * Compute the canonical signature for a declaration node. Returns null when the node is not a
 * nameable declaration (e.g. an anonymous inline callback).
 */
export function computeSignatureForDecl(node: Node, root: string): string | null {
  const sf = node.getSourceFile();
  const { modulePrefix } = fileKeyOf(sf.getFilePath(), root);
  const parts: string[] = [];
  // Ancestors come innermost-first; reverse to outermost-first so the chain reads root → leaf.
  for (const a of node.getAncestors().reverse()) {
    const nm = contributorName(a);
    if (nm !== null) parts.push(nm);
  }
  if (Node.isConstructorDeclaration(node)) {
    parts.push("constructor");
  } else {
    const own = contributorName(node);
    if (own === null) return null;
    parts.push(own);
  }
  return signatureOf(modulePrefix, ...parts);
}

/** Resolve the declaration a call/new expression targets, following import aliases. */
export function resolveCalleeDecl(call: Node): Node | undefined {
  if (!Node.isCallExpression(call) && !Node.isNewExpression(call)) return undefined;
  const expr = call.getExpression();
  let symNode: Node = expr;
  if (Node.isPropertyAccessExpression(expr)) symNode = expr.getNameNode();
  else if (Node.isElementAccessExpression(expr)) return undefined; // dynamic dispatch — best-effort skip
  let sym = symNode.getSymbol();
  if (!sym) return undefined;
  const aliased = sym.getAliasedSymbol();
  if (aliased) sym = aliased;
  const decls = sym.getDeclarations();
  return decls && decls.length ? decls[0] : undefined;
}

/**
 * Resolve a call/new site to the signature of an existing symbol-table callable, or null.
 * `allSignatures` gates the result so an edge can never dangle into a non-recorded declaration
 * (e.g. one in node_modules).
 */
export function resolveCalleeSignature(
  call: Node,
  root: string,
  allSignatures: Set<string>,
): { signature: string; isConstructor: boolean } | null {
  const decl = resolveCalleeDecl(call);
  if (!decl) return null;

  // `new X()` / a bare class reference → the class's (possibly synthesized) constructor.
  if (Node.isClassDeclaration(decl) || Node.isClassExpression(decl)) {
    const csig = computeSignatureForDecl(decl, root);
    if (!csig) return null;
    const target = constructorSignatureOf(csig);
    return allSignatures.has(target) ? { signature: target, isConstructor: true } : null;
  }

  // const f = () => {} / function expression bound to a variable.
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      const s = computeSignatureForDecl(decl, root);
      return s && allSignatures.has(s) ? { signature: s, isConstructor: false } : null;
    }
    return null;
  }

  if (isCallableDecl(decl)) {
    const s = computeSignatureForDecl(decl, root);
    return s && allSignatures.has(s)
      ? { signature: s, isConstructor: Node.isConstructorDeclaration(decl) }
      : null;
  }
  return null;
}

// --- name helpers ---

function safeName(node: { getName(): string | undefined } | { getName(): string }): string {
  const n = (node as { getName(): string | undefined }).getName();
  return n ?? "(anonymous)";
}

function classLikeName(node: Node): string {
  const n = (node as unknown as { getName?: () => string | undefined }).getName?.();
  if (n) return n;
  if ((node as unknown as { isDefaultExport?: () => boolean }).isDefaultExport?.()) return "default";
  return "(anonymous)";
}

function funcLikeName(node: Node): string {
  const fn = node as unknown as { getName?: () => string | undefined; isDefaultExport?: () => boolean };
  const n = fn.getName?.();
  if (n) return n;
  if (fn.isDefaultExport?.()) return "default";
  return "(anonymous)";
}
