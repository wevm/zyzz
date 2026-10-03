/** Autolinks the shared native adapter without application registration. @module */
export default {
  dependency: {
    platforms: {
      android: {
        cxxModuleCMakeListsModuleName: 'react_codegen_ZyzzSpec',
        cxxModuleCMakeListsPath: 'CMakeLists.txt',
        cxxModuleHeaderName: 'NativeZyzz',
        sourceDir: 'native/android',
      },
      ios: {},
    },
  },
}
