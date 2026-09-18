/** Subscribes native JSX consumers without conditional hooks in style callables. @module */
import type * as Babel from '@babel/core'

/** Reduces unshadowed immutable local style reads before Babel discovers scopes. */
export function prepare(
  api: typeof Babel,
  ast: Babel.types.File,
  callables: WeakSet<Babel.types.Node>,
) {
  const t = api.types
  const bindings = new Map<string, Babel.types.Identifier>()
  const initializers = new Map<
    Babel.types.Identifier,
    Babel.types.CallExpression
  >()
  for (const statement of ast.program.body) {
    const declaration = t.isExportNamedDeclaration(statement)
      ? statement.declaration
      : statement
    if (!t.isVariableDeclaration(declaration, { kind: 'const' })) continue
    for (const entry of declaration.declarations)
      if (t.isIdentifier(entry.id) && t.isCallExpression(entry.init)) {
        bindings.set(entry.id.name, entry.id)
        initializers.set(entry.id, entry.init)
      }
  }
  if (!bindings.size) return
  const attributes: Babel.types.JSXAttribute[] = []
  let dynamicScope = false
  function enter(node: Babel.types.Node) {
    if (t.isTSParameterProperty(node) || t.isWithStatement(node))
      dynamicScope = true
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.callee, { name: 'eval' })
    )
      dynamicScope = true
    if (t.isJSXAttribute(node)) attributes.push(node)
    if (
      t.isVariableDeclarator(node) ||
      t.isFunction(node) ||
      t.isClass(node) ||
      t.isCatchClause(node) ||
      t.isImportSpecifier(node) ||
      t.isImportDefaultSpecifier(node) ||
      t.isImportNamespaceSpecifier(node) ||
      t.isAssignmentExpression(node) ||
      t.isUpdateExpression(node) ||
      t.isForInStatement(node) ||
      t.isForOfStatement(node) ||
      (node.type.startsWith('TS') && node.type.endsWith('Declaration'))
    ) {
      for (const [name, identifiers] of Object.entries(
        t.getBindingIdentifiers(node, true),
      ))
        if (identifiers.some((identifier) => bindings.get(name) !== identifier))
          bindings.delete(name)
      if (
        'id' in node &&
        t.isIdentifier(node.id) &&
        bindings.get(node.id.name) !== node.id
      )
        bindings.delete(node.id.name)
    }
  }
  function finish() {
    if (dynamicScope) return
    for (const [name, identifier] of bindings)
      if (!callables.has(initializers.get(identifier)!)) bindings.delete(name)
    if (!bindings.size) return
    for (const attribute of attributes) {
      if (
        !t.isJSXIdentifier(attribute.name, { name: 'style' }) ||
        !t.isJSXExpressionContainer(attribute.value)
      )
        continue
      let value = attribute.value.expression
      while (
        t.isTSAsExpression(value) ||
        t.isTSTypeAssertion(value) ||
        t.isTSNonNullExpression(value) ||
        t.isTSSatisfiesExpression(value) ||
        t.isParenthesizedExpression(value)
      )
        value = value.expression
      if (
        !t.isMemberExpression(value) ||
        value.computed ||
        !t.isIdentifier(value.property, { name: 'style' }) ||
        !t.isCallExpression(value.object) ||
        value.object.arguments.length > 1 ||
        !value.object.arguments.every((argument) => t.isExpression(argument)) ||
        !t.isIdentifier(value.object.callee) ||
        !bindings.has(value.object.callee.name)
      )
        continue
      const call = value.object
      const callee = value.object.callee
      t.inheritsComments(callee, attribute.value.expression)
      t.inheritsComments(callee, value)
      t.inheritsComments(callee, call)
      callables.add(callee)
      attribute.value.expression = call.arguments.length ? call : callee
    }
  }
  return { enter, finish }
}

/** Shares Babel's normal traversal and adds one context read per styled owner. */
export function visitor(
  api: typeof Babel,
  callables: WeakSet<Babel.types.Node>,
): Babel.Visitor<Babel.PluginPass> {
  const t = api.types
  type Bindings = Map<'props' | 'style', Babel.types.Identifier>
  type Owners = Map<Babel.NodePath<Babel.types.Function>, Bindings>
  const files = new WeakMap<Babel.BabelFile, Owners>()
  return {
    Program: {
      enter(_, state) {
        files.set(state.file, new Map())
      },
      exit(path, state) {
        const owners = files.get(state.file)!
        if (!owners.size) return
        const hook = path.scope.generateUidIdentifier('useZyzzStyles')
        path.unshiftContainer(
          'body',
          t.importDeclaration(
            [t.importSpecifier(hook, t.identifier('useStyles'))],
            t.stringLiteral('zyzz/react-native/react'),
          ),
        )
        for (const [owner, bindings] of owners) {
          if (!t.isBlockStatement(owner.node.body))
            owner.node.body = t.blockStatement([
              t.returnStatement(owner.node.body),
            ])
          const context =
            bindings.size > 1
              ? owner.scope.generateUidIdentifier('zyzzStyles')
              : undefined
          const declarations = context
            ? [t.variableDeclarator(context, t.callExpression(hook, []))]
            : []
          for (const [method, binding] of bindings)
            declarations.push(
              t.variableDeclarator(
                binding,
                t.memberExpression(
                  context ?? t.callExpression(hook, []),
                  t.identifier(method),
                ),
              ),
            )
          owner.node.body.body.unshift(
            t.variableDeclaration('var', declarations),
          )
        }
      },
    },
    JSXAttribute(path, state) {
      if (
        !t.isJSXIdentifier(path.node.name, { name: 'style' }) ||
        !t.isJSXExpressionContainer(path.node.value) ||
        t.isJSXEmptyExpression(path.node.value.expression)
      )
        return
      const binding = owner(path, files.get(state.file)!, 'style')
      let inputs = [path.node.value.expression]
      let value = path.node.value.expression
      while (
        t.isTSAsExpression(value) ||
        t.isTSTypeAssertion(value) ||
        t.isTSNonNullExpression(value) ||
        t.isTSSatisfiesExpression(value) ||
        t.isParenthesizedExpression(value)
      )
        value = value.expression
      if (t.isIdentifier(value) && callables.has(value)) inputs = [value]
      else if (
        t.isCallExpression(value) &&
        t.isIdentifier(value.callee) &&
        callables.has(value.callee)
      )
        inputs = [
          value.callee,
          ...value.arguments.filter((argument) => t.isExpression(argument)),
        ]
      else if (
        t.isMemberExpression(value) &&
        !value.computed &&
        t.isIdentifier(value.property, { name: 'style' }) &&
        t.isCallExpression(value.object) &&
        value.object.arguments.length <= 1 &&
        value.object.arguments.every((argument) => t.isExpression(argument)) &&
        t.isIdentifier(value.object.callee)
      ) {
        const declaration = path.scope.getBinding(value.object.callee.name)
        if (
          declaration?.constant &&
          declaration.path.isVariableDeclarator() &&
          declaration.path.node.init &&
          callables.has(declaration.path.node.init)
        ) {
          t.inheritsComments(value.object.callee, path.node.value.expression)
          t.inheritsComments(value.object.callee, value)
          t.inheritsComments(value.object.callee, value.object)
          const input = value.object.arguments[0]
          inputs =
            input && t.isExpression(input)
              ? [value.object.callee, input]
              : [value.object.callee]
        }
      }
      path.node.value.expression = t.callExpression(binding, inputs)
    },
    JSXSpreadAttribute(path, state) {
      const binding = owner(path, files.get(state.file)!, 'props')
      path.node.argument = t.callExpression(binding, [path.node.argument])
    },
  }
  function owner(
    path: Babel.NodePath,
    owners: Owners,
    method: 'props' | 'style',
  ): Babel.types.Identifier {
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
    let bindings = owners.get(parent)
    if (!bindings) {
      bindings = new Map()
      owners.set(parent, bindings)
    }
    let binding = bindings.get(method)
    if (!binding) {
      binding = parent.scope.generateUidIdentifier(`zyzz${method}`)
      bindings.set(method, binding)
    }
    return binding
  }
}
