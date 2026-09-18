/** Keeps compiler API consumers separate from the native compiler. @module */
/** Mutates compiler API consumers’ manifests to remove TypeScript peers before dependency resolution. */
export const hooks = {
  readPackage(pkg: {
    name: string
    peerDependencies?: Record<string, string>
  }) {
    // A peer would replace the package extension with the workspace's native compiler.
    if (['@ark/attest', 'ts-evaluator', 'zile'].includes(pkg.name))
      delete pkg.peerDependencies?.typescript

    return pkg
  },
}
