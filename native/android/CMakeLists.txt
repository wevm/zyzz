cmake_minimum_required(VERSION 3.13)
project(zyzz)

add_library(react_codegen_ZyzzSpec STATIC ../NativeZyzz.cpp ZyzzSpec-generated.cpp)
target_include_directories(react_codegen_ZyzzSpec PUBLIC . ..)
target_link_libraries(react_codegen_ZyzzSpec ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni)
target_compile_features(react_codegen_ZyzzSpec PUBLIC cxx_std_20)
set_target_properties(react_codegen_ZyzzSpec PROPERTIES POSITION_INDEPENDENT_CODE ON)
