/** Keeps compiler API consumers separate from the native compiler. @module */
export const hooks = {
  readPackage(pkg: {
    name: string
    peerDependencies?: Record<string, string>
  }) {
    // A peer would replace the package extension with the workspace's native compiler.
    if (pkg.name === '@ark/attest' || pkg.name === 'zile')
      delete pkg.peerDependencies?.typescript

    return pkg
  },
}
