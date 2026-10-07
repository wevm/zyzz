/** Reads package contracts, deriving a missing sidecar from the package's JavaScript without executing it. @module */
import * as Crypto from 'node:crypto'
import * as Path from 'node:path'
import * as Graph from '../../compiler/Graph.js'
import * as Contract from '../../compiler/internal/Contract.js'
import * as Syntax from '../../compiler/internal/Syntax.js'

/** Creates a reader whose derived contracts persist across the builds of one adapter instance. */
export function create() {
  const derived = new Map<
    string,
    { contract: string | undefined; inputs: string }
  >()
  const syntax = new Map<
    string,
    { parsed: ReturnType<typeof Syntax.parse>; source: string }
  >()

  async function lookup(
    file: string,
    options: read.Options,
    active: ReadonlySet<string>,
  ): Promise<string | undefined> {
    try {
      return await options.read(`${file}.zyzz.json`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error

      const contract = await derive(file, options, active)
      if (contract === undefined && options.required) throw error
      return contract
    }
  }

  async function derive(
    file: string,
    options: read.Options,
    active: ReadonlySet<string>,
  ): Promise<string | undefined> {
    const root = await manifest(file, options)
    if (!root) return undefined

    const { directory, name } = root
    const id = (path: string) =>
      `${name}/${Path.relative(directory, path).split(Path.sep).join('/')}`
    const contracts: Record<string, string> = Object.create(null)
    const external = new Map<string, string | undefined>()
    const imports: Record<
      string,
      Record<string, string | null>
    > = Object.create(null)
    const modules: Record<string, string> = Object.create(null)
    const programs = new Map<string, ReturnType<typeof Syntax.parse>>()
    const next = new Set(active).add(file)
    let authored = false

    async function link(target: string, required = false) {
      const known = external.get(target)
      if (known !== undefined || (external.has(target) && !required))
        return known

      // A package cycle stays a runtime import.
      const contract = next.has(target)
        ? undefined
        : await lookup(target, { ...options, required }, next)
      external.set(target, contract)
      if (contract === undefined) return undefined

      contracts[target] = contract
      for (const section of Contract.read(contract, new Map(), target)
        .stylesheets) {
        let owner = target
        for (const specifier of section.dependency ?? []) {
          const resolved = await options.resolve(specifier, owner)
          if (!resolved)
            throw new Error(
              `Unable to resolve packed stylesheet dependency: ${specifier}`,
            )

          ;(imports[owner] ??= Object.create(null))[specifier] = resolved
          await link(resolved, true)
          owner = resolved
        }
      }
      return contract
    }

    async function parse(path: string) {
      const source = await options.read(path)
      let entry = syntax.get(path)
      if (entry?.source !== source) {
        entry = { parsed: Syntax.parse({ moduleId: id(path), source }), source }
        syntax.set(path, entry)
      }
      return entry
    }

    // Mirrors the Next.js loader: component exports stay runtime code, and the package ships their CSS.
    async function callable(
      path: string,
      name: string,
      seen = new Set<string>(),
    ): Promise<boolean> {
      const key = JSON.stringify([path, name])
      if (seen.has(key)) return false
      seen.add(key)

      const { program } = (await parse(path)).parsed
      const functions = new Set<string>()

      for (const statement of program.body) {
        const declaration =
          statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportDefaultDeclaration'
            ? statement.declaration
            : undefined
        const exported =
          statement.type === 'ExportDefaultDeclaration'
            ? 'default'
            : declaration &&
                'id' in declaration &&
                declaration.id?.type === 'Identifier'
              ? declaration.id.name
              : undefined

        if (
          exported &&
          (declaration?.type === 'FunctionDeclaration' ||
            declaration?.type === 'ClassDeclaration' ||
            declaration?.type === 'ArrowFunctionExpression' ||
            declaration?.type === 'FunctionExpression')
        )
          functions.add(exported)
        if (declaration?.type === 'VariableDeclaration')
          for (const item of declaration.declarations)
            if (
              item.id.type === 'Identifier' &&
              (item.init?.type === 'ArrowFunctionExpression' ||
                item.init?.type === 'FunctionExpression' ||
                item.init?.type === 'ClassExpression')
            )
              functions.add(item.id.name)
      }

      // A merged namespace can carry style definitions beside the function.
      for (const statement of program.body) {
        const declaration =
          statement.type === 'ExportNamedDeclaration'
            ? statement.declaration
            : statement
        if (
          declaration?.type === 'TSModuleDeclaration' &&
          declaration.id.type === 'Identifier'
        )
          functions.delete(declaration.id.name)
      }
      if (functions.has(name)) return true

      for (const statement of program.body) {
        if (
          statement.type !== 'ExportNamedDeclaration' ||
          !statement.source ||
          statement.exportKind === 'type'
        )
          continue

        for (const specifier of statement.specifiers) {
          const exported =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value
          if (specifier.exportKind === 'type' || exported !== name) continue

          const target = await options.resolve(statement.source.value, path)
          if (!target || !inside(directory, target)) return false
          return callable(
            target,
            specifier.local.type === 'Identifier'
              ? specifier.local.name
              : specifier.local.value,
            seen,
          )
        }
      }
      return false
    }

    async function visit(path: string) {
      const moduleId = id(path)
      if (Object.hasOwn(modules, moduleId)) return

      const entry = await parse(path)
      modules[moduleId] = entry.source
      programs.set(moduleId, entry.parsed)
      const links: Record<string, string | null> = Object.create(null)
      imports[moduleId] = links

      for (const node of entry.parsed.program.body) {
        if (
          (node.type !== 'ImportDeclaration' &&
            node.type !== 'ExportNamedDeclaration' &&
            node.type !== 'ExportAllDeclaration') ||
          !node.source
        )
          continue

        const specifier = node.source.value
        links[specifier] = null
        if (
          (node.type === 'ImportDeclaration'
            ? node.importKind === 'type'
            : node.exportKind === 'type') ||
          ('specifiers' in node &&
            node.specifiers.length &&
            node.specifiers.every((specifier) =>
              specifier.type === 'ImportSpecifier'
                ? specifier.importKind === 'type'
                : specifier.type === 'ExportSpecifier' &&
                  specifier.exportKind === 'type',
            ))
        )
          continue
        if (
          specifier === 'zyzz' ||
          (specifier.startsWith('zyzz/') && specifier !== 'zyzz/default')
        ) {
          authored = true
          continue
        }
        if (
          /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(specifier) ||
          specifier.includes('?')
        )
          continue

        const target = await options.resolve(specifier, path)
        if (
          !target ||
          !Path.isAbsolute(target) ||
          !/\.[cm]?[jt]sx?$/.test(target)
        )
          continue

        if (!inside(directory, target)) {
          if (await link(target)) links[specifier] = target
          continue
        }

        if ('specifiers' in node && node.specifiers.length) {
          const names = node.specifiers.map((item) => {
            if (item.type === 'ImportDefaultSpecifier') return 'default'
            if (item.type === 'ImportNamespaceSpecifier') return undefined
            if (item.type === 'ImportSpecifier')
              return item.importKind === 'type'
                ? null
                : item.imported.type === 'Identifier'
                  ? item.imported.name
                  : item.imported.value
            if (item.exportKind === 'type') return null
            return item.local.type === 'Identifier'
              ? item.local.name
              : item.local.value
          })
          const runtime = await Promise.all(
            names.map((name) =>
              name === null
                ? true
                : name === undefined
                  ? false
                  : callable(target, name),
            ),
          )
          if (runtime.every(Boolean)) continue
        }

        links[specifier] = id(target)
        await visit(target)
      }
    }

    await visit(file)
    if (!authored && !Object.keys(contracts).length) return undefined

    const inputs = Crypto.createHash('sha256')
      .update(JSON.stringify([modules, contracts, imports]))
      .digest('hex')
    const cached = derived.get(file)
    if (cached?.inputs === inputs) return cached.contract

    const graph = (() => {
      try {
        return Graph.compile({
          [Syntax.cache]: programs,
          compiler: false,
          contracts,
          imports,
          modules,
        })
      } catch (error) {
        throw new Error(
          `Unable to derive the Zyzz contract of ${file}: ${(error as Error).message}`,
          { cause: error },
        )
      }
    })()

    const contract = graph.contracts[id(file)]
    derived.set(file, { contract, inputs })
    return contract
  }

  return {
    /**
     * Returns the shipped `<file>.zyzz.json` contract, or derives it when the
     * package depends on Zyzz and the module graph reaches its authoring APIs.
     * Undefined marks a plain runtime import.
     */
    read(file: string, options: read.Options) {
      return lookup(file, options, new Set())
    },
  }
}

/** Contract lookup contracts. */
export declare namespace read {
  /** Capabilities of the requesting bundler. */
  type Options = {
    /** Reads a file, rejecting with `ENOENT` when it is missing. Every file whose content or absence affects the contract passes through it. */
    readonly read: (file: string) => Promise<string>
    /** Rethrows the missing sidecar error when no contract can be derived. */
    readonly required?: boolean | undefined
    /** Resolves a specifier with the bundler's conditions. Undefined marks an external. */
    readonly resolve: (
      specifier: string,
      importer: string,
    ) => Promise<string | undefined>
  }
}

function inside(directory: string, file: string) {
  const relative = Path.relative(directory, file)

  return (
    !relative.startsWith(`..${Path.sep}`) &&
    relative !== '..' &&
    !Path.isAbsolute(relative) &&
    !relative.split(Path.sep).includes('node_modules')
  )
}

/** Finds the named package owning a file, when its manifest declares Zyzz. */
async function manifest(file: string, options: read.Options) {
  for (let directory = Path.dirname(file); ; ) {
    const data = await options.read(Path.join(directory, 'package.json')).then(
      (source) => JSON.parse(source) as Record<string, unknown>,
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
        return undefined
      },
    )

    // Nested manifests without a name, such as `{"type":"module"}`, belong to the enclosing package.
    if (typeof data?.name === 'string')
      return [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
      ].some((key) => {
        const dependencies = data[key]
        return (
          !!dependencies &&
          typeof dependencies === 'object' &&
          Object.hasOwn(dependencies, 'zyzz')
        )
      })
        ? { directory, name: data.name }
        : undefined

    const parent = Path.dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}
