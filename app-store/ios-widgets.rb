# Ajoute au projet iPhone (créé par « npx cap add ios ») ce que Capacitor ne fait pas : le pont natif de GREATNESS
# (GreatnessPlugin, MainViewController) et l'extension « GreatnessWidgets » (widget « Séance du jour » et repos en
# Live Activity dans la Dynamic Island), embarquée dans l'app. Les sources viennent de native/ (copiées par
# ios-setup.mjs). Relançable sans risque. Demande la gemme xcodeproj (gem install xcodeproj).
require 'xcodeproj'

BUNDLE = ENV.fetch('BUNDLE_ID', 'io.github.raykatsu.greatness')
here = __dir__
project = Xcodeproj::Project.open(File.join(here, 'ios', 'App', 'App.xcodeproj'))
app = project.targets.find { |t| t.name == 'App' } or abort('Cible App introuvable')

def add_sources(target, refs)
  refs.each { |r| target.source_build_phase.add_file_reference(r, true) unless target.source_build_phase.files_references.include?(r) }
end
def ref(group, name)
  group.files.find { |f| f.path == name } || group.new_reference(name)
end

# Le pont natif, dans la cible App
app_group = project.main_group.children.find { |g| g.display_name == 'App' } or abort('Groupe App introuvable')
add_sources(app, [ref(app_group, 'GreatnessPlugin.swift'), ref(app_group, 'MainViewController.swift')])

# L'extension (iOS 16.2 : Live Activity et widgets de l'écran verrouillé)
widget = project.targets.find { |t| t.name == 'GreatnessWidgets' }
unless widget
  widget = project.new_target(:app_extension, 'GreatnessWidgets', :ios, '16.2', nil, :swift)
  app.add_dependency(widget)
  embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' } || app.new_copy_files_build_phase('Embed Foundation Extensions')
  embed.dst_subfolder_spec = '13' # PlugIns
  embed.dst_path = ''
  embed.add_file_reference(widget.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end
app_setting = ->(config, key) { app.build_configurations.find { |c| c.name == config }&.build_settings&.[](key) }
widget.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{BUNDLE}.widgets"
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['INFOPLIST_FILE'] = 'GreatnessWidgets/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['CODE_SIGN_ENTITLEMENTS'] = 'GreatnessWidgets/GreatnessWidgets.entitlements'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  # même version que l'app (exigé par l'App Store)
  s['MARKETING_VERSION'] = app_setting.(c.name, 'MARKETING_VERSION') || '1.0'
  s['CURRENT_PROJECT_VERSION'] = app_setting.(c.name, 'CURRENT_PROJECT_VERSION') || '1'
end
wgroup = project.main_group.children.find { |g| g.display_name == 'GreatnessWidgets' } || project.main_group.new_group('GreatnessWidgets', 'GreatnessWidgets')
%w[Info.plist GreatnessWidgets.entitlements].each { |f| ref(wgroup, f) }
add_sources(widget, %w[GreatnessWidgetsBundle.swift RestLiveActivity.swift NextSessionWidget.swift].map { |f| ref(wgroup, f) })
# le repos en cours : connu de l'app (qui lance la Live Activity) et de l'extension (qui la dessine)
shared = ref(wgroup, 'RestAttributes.swift')
add_sources(widget, [shared])
add_sources(app, [shared])

project.save
puts "Projet iPhone : pont natif et extension GreatnessWidgets (#{BUNDLE}.widgets) ajoutés."
