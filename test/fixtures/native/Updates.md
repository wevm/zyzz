# Native update fixture

`Updates.tsx` verifies selective updates on Fabric. It measures native bounds, captures callback-ref cleanup, and records component renders. The owning test samples pixels from native screenshots and runs the fixture with React Compiler enabled.

Prepare a Debug Expo app using the repository's React Native example dependencies. Set both native application identifiers to `xyz.wevm.zyzz.updates` and the component name to `main`. Include Zyzz through normal autolinking, then build its iOS simulator app or Android APK. No manual module registration is required.

Build the library before running the fixture. Set the prebuilt application's path and a booted device identifier:

```sh
pnpm build
ZYZZ_NATIVE_IOS_APP=/absolute/path/ZyzzNativeUpdates.app \
ZYZZ_NATIVE_IOS_DEVICE=SIMULATOR_UDID \
pnpm exec vp test run src/react-native/internal/Device.test.ts
```

For Android, use `ZYZZ_NATIVE_ANDROID_APP=/absolute/path/app-debug.apk` and `ZYZZ_NATIVE_ANDROID_DEVICE=emulator-5580`, with `adb` on `PATH`.

The test owns an isolated Expo project, Metro process, report server, and Android port forwarding. It installs and launches the supplied application and stops it afterward. Cases skip when their application and device variables are absent.

Bounds are rounded to the nearest logical unit across display densities. Colors include alpha and are checked without tolerance. Current checks cover RN 0.86.3, Expo 57, iOS 26.5, and Android 16. Exact Tempro RN 0.86.0 and RN 0.87 checks remain pending.
