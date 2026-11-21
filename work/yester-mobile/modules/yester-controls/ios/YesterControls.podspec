Pod::Spec.new do |s|
  s.name = 'YesterControls'
  s.version = '0.2.2'
  s.summary = 'YESTER browser controls'
  s.author = 'RODDY'
  s.homepage = 'https://yestersites.com'
  s.license = 'Proprietary'
  s.platform = :ios, '16.0'
  s.source = { :git => 'https://github.com/lionsarmor/yester.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
