/** Private Fabric bridge for committed view bindings. @module */
import type { CodegenTypes, TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/** Codegen contract, consumed only by the native adapter. */
export interface Spec extends TurboModule {
  /** Links a mounted Fabric node and its rendered style. */
  readonly attach: (
    node: CodegenTypes.UnsafeObject,
    props: CodegenTypes.UnsafeObject,
  ) => number
  /** Releases a view binding. */
  readonly detach: (id: number) => void
  /** Reports live bindings and applied update batches. */
  readonly inspect: () => CodegenTypes.UnsafeObject
  /** Applies one batch of changed native styles. */
  readonly update: (updates: ReadonlyArray<CodegenTypes.UnsafeObject>) => void
}

export default TurboModuleRegistry.get<Spec>('NativeZyzz')
