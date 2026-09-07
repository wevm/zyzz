import * as Walker from 'oxc-walker'

/** ScopeTracker extension that keeps body variables out of parameter initializers. */
export class Tracker extends Walker.ScopeTracker {
  protected override getVarScopeKey(): string {
    for (let index = this.scopeOwnerStack.length - 1; index >= 0; index--) {
      const owner = this.scopeOwnerStack[index]!
      if (
        owner.type === 'ArrowFunctionExpression' ||
        owner.type === 'FunctionDeclaration' ||
        owner.type === 'FunctionExpression'
      ) {
        // oxc-walker 1.1.1 hoists body vars into the parameter environment.
        // Its existing body scope preserves the enclosing parameter bindings.
        if (this.scopeOwnerStack[index + 1] === owner.body)
          return this.getScopeKeyAt(index + 1)
        break
      }
      if (
        owner.type === 'Program' ||
        owner.type === 'StaticBlock' ||
        owner.type === 'TSModuleBlock'
      )
        break
    }
    return super.getVarScopeKey()
  }
}
