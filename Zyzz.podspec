require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'Zyzz'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = 'https://github.com/wevm/zyzz'
  spec.license = package['license']
  spec.author = 'wevm'
  spec.source = { :git => 'https://github.com/wevm/zyzz.git', :tag => spec.version.to_s }
  spec.platforms = { :ios => min_ios_version_supported }
  spec.source_files = 'native/*.{h,cpp}', 'native/ios/*.mm'
  spec.pod_target_xcconfig = { 'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/native"' }
  install_modules_dependencies(spec)
end
