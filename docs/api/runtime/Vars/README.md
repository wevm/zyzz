# Vars

Compiler-generated variable contracts use `Vars` from `zyzz/runtime`. Applications normally import the authoring namespace from `zyzz` and call `Vars.define`.

## create

`Vars.create(slots)` accepts `Vars.References<schema>` and returns `Vars.Definition<schema>` (types from the root authoring namespace). The compiler supplies fixed references with a custom-property name and scalar domain. The helper freezes those references and attaches a bound, nonenumerable `set(values)` method before freezing the contract.

The method copies typed assignments to fixed custom-property names and returns a frozen object. It performs no runtime CSS value validation or rule generation. See [vars.set](../../core/Vars/set.md).
