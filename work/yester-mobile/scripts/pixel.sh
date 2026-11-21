#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-"$HOME/Android/Sdk"}}
if [[ ! -x "$sdk/emulator/emulator" && -x "$HOME/.cache/yester-build/android/emulator/emulator" ]]; then
  sdk="$HOME/.cache/yester-build/android"
fi
export ANDROID_HOME="$sdk"
export PATH="$sdk/platform-tools:$sdk/emulator:$PATH"
name=${YESTER_AVD:-YESTER_Pixel}
if ! emulator -list-avds | grep -Fxq "$name"; then
  echo "Create the $name Pixel device in Android Device Manager or set YESTER_AVD to an existing device." >&2
  exit 1
fi
if ! adb devices | grep -q '^emulator-.*device$'; then
  emulator -avd "$name" >/tmp/yester-pixel-emulator.log 2>&1 &
fi
adb -e wait-for-device
until [[ "$(adb -e shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; do sleep 2; done
if [[ "${YESTER_DEV:-0}" != 1 ]] && adb -e shell pm path world.roddy.yester | grep -q '^package:'; then
  exec adb -e shell am start -n world.roddy.yester/.MainActivity
fi
adb -e reverse tcp:8081 tcp:8081
if curl --max-time 2 -fsS http://127.0.0.1:8081/status 2>/dev/null | grep -q "packager-status:running" && adb -e shell pm path host.exp.exponent | grep -q '^package:'; then
  adb -e shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081 host.exp.exponent
  exit 0
fi
if ! command -v node >/dev/null && [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
exec ./node_modules/.bin/expo start --go --localhost --android
