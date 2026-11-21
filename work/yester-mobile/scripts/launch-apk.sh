#!/usr/bin/env bash
# Open a local release on the named virtual device, preserving its app data.
set -euo pipefail
apk=${1:?Supply the path to the YESTER APK}
[[ -r "$apk" ]]
name=${YESTER_AVD:-YESTER_Pixel}
sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-"$HOME/Android/Sdk"}}
[[ -x "$sdk/emulator/emulator" ]] || sdk="$HOME/.cache/yester-build/android"
adb="$sdk/platform-tools/adb"
emu="$sdk/emulator/emulator"
export ANDROID_HOME="$sdk"
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/yester-launch-$UID.lock"
flock 9
find_device(){
  while read -r serial state rest; do
    if [[ $serial == emulator-* && $state == device && "$("$adb" -s "$serial" emu avd name | tr -d '\r' | head -1)" == "$name" ]]; then
      echo "$serial"; return
    fi
  done < <("$adb" devices)
}
serial=$(find_device)
if [[ -z "$serial" ]]; then
  "$emu" -list-avds | grep -Fxq "$name"
  nohup "$emu" -avd "$name" -gpu software -memory 2048 -cores 2 9>&- >"${TMPDIR:-/tmp}/yester-pixel-$UID.log" 2>&1 </dev/null &
  for ((i=0;i<150;i++)); do serial=$(find_device); [[ -z "$serial" ]] || break; sleep 2; done
fi
[[ -n "$serial" ]]
for ((i=0;i<120;i++)); do [[ "$("$adb" -s "$serial" shell getprop sys.boot_completed | tr -d '\r')" != 1 ]] || break; sleep 2; done
"$adb" -s "$serial" install -r "$apk"
"$adb" -s "$serial" shell input keyevent KEYCODE_WAKEUP
"$adb" -s "$serial" shell wm dismiss-keyguard
"$adb" -s "$serial" shell am start -W -n world.roddy.yester/.MainActivity
if command -v wmctrl >/dev/null; then wmctrl -a "$name" || true; fi
