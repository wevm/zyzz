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

`generate` compiles `Styles.ts` for each platform before Metro starts. After editing style definitions, rerun `pnpm --dir examples/expo-native generate`. Application edits use ordinary Metro refresh. A local Metro resolver maps NodeNext `.js` imports to their TypeScript sources. This example does not install a Zyzz Metro transform or compile styles on the device.

```sh
pnpm --dir examples/expo-native build
```

The build generates styles, checks application types, and exports both native JavaScript bundles. The existing Examples workflow discovers this package and builds it without deploying it as a website.

## Evidence limits

Expo 57.0.23, React 19.2.3, and React Native 0.86.3 match the stable Expo template. The repository's native inventory targets React Native 0.87.0. This app does not replace that inventory or prove compatibility with its newer APIs. See Expo's [SDK compatibility table](https://docs.expo.dev/versions/latest/).

The three View samples assert `ViewStyle` at the component boundary. Generated callables expose the broader native inventory type, which includes color values rejected by Expo 57's legacy declarations. App type checking therefore does not establish end-to-end generated style assignability.

Bundle export and type checking do not prove native layout or rendering. Device evidence must record OS, device, renderer, density, font scale, screenshots, and observed differences. No device results are recorded yet. Theme/scheme changes, animated values, opaque colors, Host lifecycle, and exhaustive inventory coverage remain follow-up work.
