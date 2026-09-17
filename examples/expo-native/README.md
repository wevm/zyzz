# Expo native comparisons

This app compares ahead-of-time Zyzz output with independently authored React Native controls on iOS and Android. A switch changes variant padding and scalar callback width. A static sample exercises platform overrides. Stable test IDs identify both sides for later device automation.

## Run

From the repository root:

```sh
pnpm install
pnpm build
pnpm --dir examples/expo-native ios
# or
pnpm --dir examples/expo-native android
```

Expo Go compatible with SDK 57 and a device or configured simulator/emulator are required. `pnpm --dir examples/expo-native dev` displays the connection QR code. Expo's [environment setup](https://docs.expo.dev/get-started/set-up-your-environment/) describes device requirements.

`zyzz/metro` compiles `Styles.ts` during bundling with the requested iOS or Android platform. The app imports that source module directly. Metro tracks edits to imported style modules. A local resolver maps NodeNext `.js` imports to TypeScript sources. No separate generation command or application style artifacts are required.

```sh
pnpm --dir examples/expo-native build
```

The build checks application types and exports both native JavaScript bundles. The existing Examples workflow discovers this package and builds it without deploying it as a website.

## Evidence limits

Expo 57.0.23, React 19.2.3, and React Native 0.86.3 match the stable Expo template. The repository's native inventory targets React Native 0.87.0. This app does not replace that inventory or prove compatibility with its newer APIs. See Expo's [SDK compatibility table](https://docs.expo.dev/versions/latest/).

The three View samples assert `ViewStyle` at the component boundary. TypeScript checks the shared authoring source before Metro rewrites its return values into native styles. App type checking therefore does not establish end-to-end generated style assignability.

Bundle export and type checking do not prove native layout or rendering. Device evidence must record OS, device, renderer, density, font scale, screenshots, and observed differences. No device results are recorded yet. Theme/scheme changes, animated values, opaque colors, Host lifecycle, and exhaustive inventory coverage remain follow-up work.
