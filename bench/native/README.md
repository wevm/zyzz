# Native benchmarks

This suite compares Zyzz, React Native `StyleSheet`, and Unistyles 3 using the same component counts, native properties, and state changes. Run this suite locally. Native compiler, iOS, and Android benchmark jobs are excluded from CI. The Expo example remains independent and compatible with Expo Go.

## Measurements

| Lane                 | Boundary                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cold compilation     | Fresh Node process startup, Babel/plugin loading, and the first Expo Babel transform                                     |
| Warm compilation     | Authoring transform, TypeScript/JSX lowering, and source maps in a warm process                                          |
| Edited module        | The same transform after changing a literal; full module recompilation with no Metro cache, not incremental graph timing |
| Native mount/remount | State request until all expected native views report validated layout                                                    |
| Native update        | Dynamic width, variant width, or theme padding request until every native view reports the expected new layout           |

Compiler lanes author 10, 100, and 1,000 definitions per module. Native render lanes mount 10, 100, and 1,000 views with repeated styles, unique styles, dynamic values, variants, and theme changes. Repeated, dynamic, variant, and theme render lanes reuse one style definition; the unique lane authors one per view. Static lanes measure mount/remount only. All views remain mounted without virtualization and use identical layout listeners and non-collapsable native views. Layout checks are independent numeric expectations in the app, not values computed from the transformed styles.

Native time includes React scheduling, Fabric/Yoga work, and event delivery back to JavaScript. It is **not GPU presentation time**, pure React CPU time, or physical-device performance. Theme changes use each library's normal mechanism; Unistyles updates its native nodes without forcing a React render. All libraries are loaded in one app, with their authoring transforms restricted to their own fixture directories. This suite does not measure package startup or compare binary sizes.

Release builds use Hermes and the New Architecture. Each lane discards three warmup iterations and retains 20 iterations in each of two library orders. Reports retain both passes, median, p95, and coefficient of variation. Cold transforms retain at least ten fresh-process samples. Do not infer a speed ranking from one shared-runner result. There are no timing gates until a stable baseline is available.

## Local runs

Native dependency versions are pinned in `pnpm-workspace.yaml`. Unistyles requires custom native code and cannot run in Expo Go. See [Unistyles installation](https://unistyl.es/v3/start/getting-started/) and its [Nitro compatibility table](https://github.com/jpudysz/react-native-unistyles#installation).

From the repository root, install dependencies and prepare the package, host tools, and fixtures:

```sh
pnpm install --frozen-lockfile
pnpm build
node bench/native/Build.ts
node bench/results/native/tools/Prepare.mjs
pnpm --dir bench/native/app check:types
pnpm exec vp test run --config bench/native/Check.config.ts
```

Measure compilation locally and save the results:

```sh
pnpm exec vp test bench --config bench/native/Compile.config.ts --run --no-file-parallelism --outputJson bench/results/native/compile-timings.json
```

For render measurements, prebuild `bench/native/app` with Expo and install a Release build on a booted iOS simulator or Android emulator. iOS requires Xcode and CocoaPods; Android requires the Android SDK and Java. Development builds are rejected. Once the app is installed, run the collector from the repository root:

```sh
node bench/results/native/tools/Run.mjs ios "$SIMULATOR_UDID"
node bench/results/native/tools/Run.mjs android emulator-5554
```

The collector listens only on the host loopback address. The benchmark Android app allows HTTP for the emulator host connection. These settings belong only to this benchmark app. Results remain under ignored `bench/results/native/`; preserve raw samples and machine metadata when sharing measurements.

Android and iOS timings are separate populations and must not be compared directly. Before a release claim, repeat on idle physical devices and preserve device thermal conditions and power settings.
