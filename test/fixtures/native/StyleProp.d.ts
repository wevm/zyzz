/** Extracts the React Native 0.87.0 recursive style input contract for interoperability checks. @module */
// Copyright (c) Meta Platforms, Inc. and affiliates. MIT license:
// test/conformance/native/upstream/LICENSE. Source pinned by test/conformance/native/pin.json.
type Falsy = undefined | null | false | ''
interface RecursiveArray<T> extends Array<
  T | ReadonlyArray<T> | RecursiveArray<T>
> {}
export type StyleProp<T> = T | RecursiveArray<T | Falsy> | Falsy
