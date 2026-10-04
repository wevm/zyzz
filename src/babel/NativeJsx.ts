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
  type Method = 'nativeStyle' | 'props' | 'style' | 'view'
  type Bindings = Map<Method, Babel.types.Identifier>
  type Owners = Map<Babel.NodePath<Babel.types.Function>, Bindings>
  const files = new WeakMap<Babel.BabelFile, Owners>()
  const native = new WeakSet<Babel.types.JSXOpeningElement>()
  const animated = new WeakSet<Babel.types.JSXOpeningElement>()
  const wrapped = new WeakSet<Babel.types.JSXOpeningElement>()
  return {
    Program: {
      enter(_, state) {
        files.set(state.file, new Map())
      },
      exit(path, state) {
        const owners = files.get(state.file)!
        if (!owners.size) return
        const hooks = new Map<boolean, Babel.types.Identifier>()
        for (const native of [false, true]) {
          if (
            ![...owners.values()].some((bindings) =>
              [...bindings.keys()].some(
                (method) =>
                  (method === 'nativeStyle' || method === 'view') === native,
              ),
            )
          )
            continue
          const hook = path.scope.generateUidIdentifier(
            native ? 'useZyzzNativeStyles' : 'useZyzzStyles',
          )
          hooks.set(native, hook)
          path.unshiftContainer(
            'body',
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.cloneNode(hook),
                  t.identifier(native ? 'useNativeStyles' : 'useStyles'),
                ),
              ],
              t.stringLiteral('zyzz/react-native/react'),
            ),
          )
        }
        for (const [owner, bindings] of owners) {
          if (!t.isBlockStatement(owner.node.body))
            owner.node.body = t.blockStatement([
              t.returnStatement(owner.node.body),
            ])
          const declarations: Babel.types.VariableDeclarator[] = []
          for (const [native, hook] of hooks) {
            const entries = [...bindings].filter(
              ([method]) =>
                (method === 'nativeStyle' || method === 'view') === native,
            )
            const context =
              entries.length > 1
                ? owner.scope.generateUidIdentifier('zyzzStyles')
                : undefined
            if (context)
              declarations.push(
                t.variableDeclarator(
                  t.cloneNode(context),
                  t.callExpression(t.cloneNode(hook), []),
                ),
              )
            for (const [method, binding] of entries)
              declarations.push(
                t.variableDeclarator(
                  t.cloneNode(binding),
                  t.memberExpression(
                    context
                      ? t.cloneNode(context)
                      : t.callExpression(t.cloneNode(hook), []),
                    t.identifier(method === 'nativeStyle' ? 'style' : method),
                  ),
                ),
              )
          }
          owner.node.body.body.unshift(
            t.variableDeclaration('var', declarations),
          )
        }
      },
    },
    JSXOpeningElement: {
      enter(path, state) {
        const name = path.node.name
        const root = (() => {
          if (t.isJSXIdentifier(name)) return name
          if (t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.object))
            return name.object
          return undefined
        })()
        if (!root) return
        const binding = path.scope.getBinding(root.name)
        if (
          binding?.path.parentPath?.isImportDeclaration() &&
          binding.path.parentPath.node.source.value ===
            'react-native-reanimated'
        ) {
          animated.add(path.node)
          return
        }
        if (binding?.constant && binding.path.isVariableDeclarator()) {
          const call = binding.path.node.init
          if (t.isCallExpression(call)) {
            const callee = call.callee
            const name = t.isIdentifier(callee)
              ? callee
              : t.isMemberExpression(callee) &&
                  !callee.computed &&
                  t.isIdentifier(callee.object) &&
                  t.isIdentifier(callee.property, { name: 'withStyles' })
                ? callee.object
                : undefined
            const factory = name && binding.path.scope.getBinding(name.name)
            if (
              factory?.path.parentPath?.isImportDeclaration() &&
              ['zyzz/react-native', 'zyzz/react-native/react'].includes(
                factory.path.parentPath.node.source.value,
              ) &&
              (t.isIdentifier(callee)
                ? factory.path.isImportSpecifier() &&
                  t.isIdentifier(factory.path.node.imported, {
                    name: 'withStyles',
                  })
                : factory.path.isImportNamespaceSpecifier())
            ) {
              wrapped.add(path.node)
              return
            }
          }
        }
        if (
          !binding?.path.parentPath?.isImportDeclaration() ||
          binding.path.parentPath.node.source.value !== 'react-native'
        )
          return
        const imported = (() => {
          if (
            binding.path.isImportSpecifier() &&
            t.isIdentifier(binding.path.node.imported)
          )
            return binding.path.node.imported.name
          if (
            t.isJSXMemberExpression(name) &&
            binding.path.isImportNamespaceSpecifier()
          )
            return name.property.name
          return undefined
        })()
        if (
          !imported ||
          !['Image', 'Pressable', 'Text', 'TextInput', 'View'].includes(
            imported,
          )
        )
          return
        if (
          !path.node.attributes.some(
            (attribute) =>
              t.isJSXSpreadAttribute(attribute) ||
              (t.isJSXAttribute(attribute) &&
                t.isJSXIdentifier(attribute.name, { name: 'style' })),
          )
        )
          return
        native.add(path.node)
        owner(path, files.get(state.file)!, 'view')
      },
      exit(path, state) {
        if (!native.has(path.node)) return
        const properties: (
          | Babel.types.ObjectProperty
          | Babel.types.SpreadElement
        )[] = []
        for (const attribute of path.node.attributes) {
          if (t.isJSXSpreadAttribute(attribute))
            properties.push(t.spreadElement(attribute.argument))
          else if (t.isJSXIdentifier(attribute.name)) {
            const value = attribute.value
            const expression = (() => {
              if (value === null) return t.booleanLiteral(true)
              if (
                t.isJSXExpressionContainer(value) &&
                !t.isJSXEmptyExpression(value.expression)
              )
                return value.expression
              if (t.isStringLiteral(value))
                return t.stringLiteral(value.value.replace(/\n\s+/g, ' '))
              if (t.isJSXElement(value) || t.isJSXFragment(value)) return value
              return undefined
            })()
            if (!expression)
              throw path.buildCodeFrameError(
                'Unsupported native JSX attribute.',
              )
            properties.push(
              t.objectProperty(
                t.stringLiteral(attribute.name.name),
                expression,
              ),
            )
          } else
            throw path.buildCodeFrameError('Unsupported native JSX attribute.')
        }
        const binding = owner(path, files.get(state.file)!, 'view')
        const props = t.objectExpression(properties)
        const key = path.node.attributes.some(
          (attribute) =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name, { name: 'key' }),
        )
        const temporary = key
          ? path.scope.generateUidIdentifier('zyzzProps')
          : undefined
        if (temporary)
          path.scope.push({ id: t.cloneNode(temporary), kind: 'var' })
        path.node.attributes = [
          t.jsxSpreadAttribute(
            t.callExpression(binding, [
              temporary
                ? t.assignmentExpression('=', t.cloneNode(temporary), props)
                : props,
            ]),
          ),
          ...(temporary
            ? [
                t.jsxAttribute(
                  t.jsxIdentifier('key'),
                  t.jsxExpressionContainer(
                    t.memberExpression(
                      t.cloneNode(temporary),
                      t.identifier('key'),
                    ),
                  ),
                ),
              ]
            : []),
        ]
      },
    },
    JSXAttribute(path, state) {
      if (
        !t.isJSXIdentifier(path.node.name, { name: 'style' }) ||
        !t.isJSXExpressionContainer(path.node.value) ||
        t.isJSXEmptyExpression(path.node.value.expression)
      )
        return
      if (
        animated.has(path.parentPath.node as Babel.types.JSXOpeningElement) &&
        !requiresResolution(path, path.node.value.expression)
      )
        return
      if (wrapped.has(path.parentPath.node as Babel.types.JSXOpeningElement)) {
        const value = path.node.value.expression
        if (t.isIdentifier(value) && callables.has(value))
          path.node.value.expression = t.memberExpression(
            t.callExpression(value, []),
            t.identifier('style'),
          )
        else if (
          t.isCallExpression(value) &&
          t.isIdentifier(value.callee) &&
          callables.has(value.callee)
        )
          path.node.value.expression = t.memberExpression(
            value,
            t.identifier('style'),
          )
        return
      }
      const binding = owner(
        path,
        files.get(state.file)!,
        native.has(path.parentPath.node as Babel.types.JSXOpeningElement)
          ? 'nativeStyle'
          : 'style',
      )
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
      if (
        (animated.has(path.parentPath.node as Babel.types.JSXOpeningElement) &&
          !requiresResolution(path, path.node.argument)) ||
        native.has(path.parentPath.node as Babel.types.JSXOpeningElement) ||
        wrapped.has(path.parentPath.node as Babel.types.JSXOpeningElement)
      )
        return
      const binding = owner(path, files.get(state.file)!, 'props')
      path.node.argument = t.callExpression(binding, [path.node.argument])
    },
  }
  function requiresResolution(
    path: Babel.NodePath,
    expression: Babel.types.Node,
  ): boolean {
    let required = false
    t.traverseFast(expression, (node) => {
      if (
        callables.has(node) ||
        t.isCallExpression(node) ||
        (t.isMemberExpression(node) &&
          !node.computed &&
          t.isIdentifier(node.property, { name: 'style' }))
      )
        required = true
      if (!t.isIdentifier(node)) return
      const binding = path.scope.getBinding(node.name)
      if (
        binding?.path.isVariableDeclarator() &&
        binding.path.node.init &&
        callables.has(binding.path.node.init)
      )
        required = true
    })
    return required
  }
  function owner(
    path: Babel.NodePath,
    owners: Owners,
    method: Method,
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
    return t.cloneNode(binding)
  }
}
