/** Subscribes native JSX consumers without conditional hooks in style callables. @module */
import type * as Babel from '@babel/core'

/** Adds one unconditional context read to each styled function component. */
export function transform(api: typeof Babel, file: Babel.BabelFile) {
  const t = api.types
  const owners = new Map<
    Babel.NodePath<Babel.types.Function>,
    Babel.types.Identifier
  >()
  file.path.traverse({
    JSXAttribute(path) {
      if (
        !t.isJSXIdentifier(path.node.name, { name: 'style' }) ||
        !t.isJSXExpressionContainer(path.node.value) ||
        t.isJSXEmptyExpression(path.node.value.expression)
      )
        return
      const binding = owner(path)
      path.node.value.expression = t.callExpression(
        t.memberExpression(binding, t.identifier('style')),
        [path.node.value.expression],
      )
    },
    JSXSpreadAttribute(path) {
      const binding = owner(path)
      path.node.argument = t.callExpression(
        t.memberExpression(binding, t.identifier('props')),
        [path.node.argument],
      )
    },
  })
  if (!owners.size) return
  const hook = file.scope.generateUidIdentifier('useZyzzStyles')
  file.path.unshiftContainer(
    'body',
    t.importDeclaration(
      [t.importSpecifier(hook, t.identifier('useStyles'))],
      t.stringLiteral('zyzz/react-native/react'),
    ),
  )
  for (const [path, binding] of owners) {
    if (!t.isBlockStatement(path.node.body))
      path.node.body = t.blockStatement([t.returnStatement(path.node.body)])
    path.node.body.body.unshift(
      t.variableDeclaration('const', [
        t.variableDeclarator(binding, t.callExpression(hook, [])),
      ]),
    )
  }
  function owner(path: Babel.NodePath): Babel.types.Identifier {
    const parent = path.findParent((candidate) => {
      if (!candidate.isFunction()) return false
      let declaration = candidate.parentPath
      while (declaration.isCallExpression())
        declaration = declaration.parentPath
      const name =
        ('id' in candidate.node ? candidate.node.id?.name : undefined) ??
        (declaration.isVariableDeclarator() &&
        t.isIdentifier(declaration.node.id)
          ? declaration.node.id.name
          : undefined)
      return (
        (!!name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name))) ||
        candidate.parentPath.isExportDefaultDeclaration()
      )
    })
    if (!parent?.isFunction() || parent.isClassMethod())
      throw path.buildCodeFrameError(
        'Native style props must be rendered in a function component or custom hook.',
      )
    let binding = owners.get(parent)
    if (!binding) {
      binding = parent.scope.generateUidIdentifier('zyzzStyles')
      owners.set(parent, binding)
    }
    return binding
  }
}
