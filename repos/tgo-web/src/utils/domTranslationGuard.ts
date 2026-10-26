/**
 * Keeps React working when the browser's page translation rewrites the DOM.
 *
 * Translators (Chrome/Brave/Edge, Google Translate extension) replace text nodes
 * with <font> wrappers behind React's back. React later calls insertBefore/removeChild
 * with the original text node, which is no longer a child, and the whole app crashes
 * with "NotFoundError: Failed to execute 'insertBefore' on 'Node'".
 * See https://github.com/facebook/react/issues/11538
 */

/** Return the ancestor of `node` (or `node` itself) that is a direct child of `parent`. */
const findDirectChild = (parent: Node, node: Node): Node | null => {
  let current: Node | null = node;
  while (current && current.parentNode !== parent) {
    current = current.parentNode;
  }
  return current;
};

export const installDomTranslationGuard = (): void => {
  if (typeof Node !== 'function' || !Node.prototype) return;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // Already detached by the translator: removing it is a no-op
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Insert before the translator's wrapper so sibling order is preserved
      const wrapper = findDirectChild(this, referenceNode);
      return originalInsertBefore.call(this, newNode, wrapper) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
};

installDomTranslationGuard();
