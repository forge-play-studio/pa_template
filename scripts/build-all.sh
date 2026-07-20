#!/usr/bin/env bash
#
# 批量构建所有 语言×渠道×埋点×目标平台 组合。
#
# 配置来源:
#   package.json appConfig.i18n.buildVersions
#   package.json appConfig.i18n.channels
#   package.json appConfig.naming
#   package.json appConfig.delivery.platforms
#
# 用法:
#   ./scripts/build-all.sh                  # 构建全部
#   ./scripts/build-all.sh en               # 只构建 EN 全部渠道
#   ./scripts/build-all.sh tw applovin      # 只构建 TW + applovin（有埋点+无埋点）
#   ./scripts/build-all.sh tw applovin ios  # 只构建 TW + applovin 的 iOS 定向包
#
# 输出:
#   dist/EN/tracked/<命名>.html                     # universal
#   dist/EN/tracked/android/<命名>_android.html     # platform-build
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

npm run test:gameworld-architecture
npm run test:gameworld-lifecycle

read_json() {
  node -e "const p=require('./package.json'); console.log($1)"
}

IFS=' ' read -ra TRACKED_CHANNELS <<< "$(read_json "p.appConfig.i18n.channels.tracked.join(' ')")"
IFS=' ' read -ra UNTRACKED_CHANNELS <<< "$(read_json "p.appConfig.i18n.channels.untracked.join(' ')")"
IFS=' ' read -ra BUILD_VERSIONS <<< "$(read_json "p.appConfig.i18n.buildVersions.join(' ')")"
IFS=' ' read -ra ALL_LOCALES <<< "$(read_json "Object.keys(p.appConfig.i18n.locales).join(' ')")"
IFS=' ' read -ra DELIVERY_PLATFORMS <<< "$(read_json "((p.appConfig.delivery && p.appConfig.delivery.platforms) || ['universal']).join(' ')")"

if [ "${#DELIVERY_PLATFORMS[@]}" -eq 0 ]; then
  echo "appConfig.delivery.platforms must contain universal, android, or ios"
  exit 1
fi
for platform in "${DELIVERY_PLATFORMS[@]}"; do
  case "$platform" in
    universal|android|ios) ;;
    *)
      echo "Unsupported delivery platform in appConfig.delivery.platforms: $platform"
      exit 1
      ;;
  esac
done

PROJECT_CODE="$(read_json "p.appConfig.naming.projectCode")"
MATERIAL_ID="$(read_json "p.appConfig.naming.materialId")"
CREATOR="$(read_json "p.appConfig.naming.creator")"
VENDOR="$(read_json "p.appConfig.naming.vendor")"
MATERIAL_NAME="$(read_json "p.appConfig.naming.materialName")"
DEFAULT_CHANNEL="$(read_json "p.appConfig.analytics.adNetwork || 'applovin'")"
DEFAULT_PLATFORM="${DELIVERY_PLATFORMS[0]:-universal}"
BUILD_DATE=$(date +%Y%m%d)
FIXED_VENDOR="ForgePlay"

if [ "$VENDOR" != "$FIXED_VENDOR" ]; then
  echo "appConfig.naming.vendor is template-managed and must be ${FIXED_VENDOR}; do not edit it"
  exit 1
fi

TARGET="${1:-all}"
CHANNEL_FILTER="${2:-}"
PLATFORM_FILTER="${3:-}"
BUILD_COUNT=0
FAIL_COUNT=0

make_filename() {
  local locale="$1"
  local channel="$2"
  local tracking="$3"
  local platform="$4"
  local base="${PROJECT_CODE}_${MATERIAL_ID}_${locale}_${CREATOR}_${BUILD_DATE}_${VENDOR}_${channel}_${MATERIAL_NAME}"

  if [ "$platform" != "universal" ]; then
    base="${base}_${platform}"
  fi

  if [ "$locale" = "KR" ]; then
    base="${base}^概率公示"
  fi

  if [ "$tracking" = "true" ]; then
    base="${base}^有埋点"
  fi

  echo "${base}.html"
}

build_variant() {
  local locale="$1"
  local channel="$2"
  local tracking="$3"
  local platform="$4"
  local track_dir
  if [ "$tracking" = "true" ]; then track_dir="tracked"; else track_dir="untracked"; fi

  local filename
  filename=$(make_filename "$locale" "$channel" "$tracking" "$platform")
  local out_dir="dist/${locale}/${track_dir}"
  if [ "$platform" != "universal" ]; then out_dir="${out_dir}/${platform}"; fi

  echo "========================================="
  echo "  Building: ${track_dir}  LOCALE=${locale}  CHANNEL=${channel}  PLATFORM=${platform}"
  echo "  -> ${out_dir}/${filename}"
  echo "========================================="

  rm -rf "dist/_build"

  if LOCALE="$locale" CHANNEL="$channel" TRACKING="$tracking" TARGET_PLATFORM="$platform" BUILD_MATRIX=true SCENE_WALKTHROUGH_BUILD=false npm run typecheck && LOCALE="$locale" CHANNEL="$channel" TRACKING="$tracking" TARGET_PLATFORM="$platform" BUILD_MATRIX=true SCENE_WALKTHROUGH_BUILD=false npx vite build && node scripts/check-scene-walkthrough-build.mjs --disabled dist/_build/index.html && npm run check:prod-debug; then
    mkdir -p "$out_dir"
    mv "dist/_build/index.html" "${out_dir}/${filename}"

    # Keep one stable visual/raw Rollup report for bundle diagnosis. The
    # representative build is EN + tracked + the project's default channel;
    # later variants must not overwrite it.
    if [ "${BUNDLE_STATS:-false}" = "true" ] && [ "$locale" = "EN" ] && [ "$tracking" = "true" ] && [ "$channel" = "$DEFAULT_CHANNEL" ] && [ "$platform" = "$DEFAULT_PLATFORM" ]; then
      test -f "dist/_build/stats.html"
      test -f "dist/_build/stats.json"
      mv "dist/_build/stats.html" "dist/stats.html"
      mv "dist/_build/stats.json" "dist/stats.json"
    fi

    rm -rf "dist/_build"
    BUILD_COUNT=$((BUILD_COUNT + 1))
  else
    echo "  [FAILED] ${track_dir} LOCALE=${locale} CHANNEL=${channel} PLATFORM=${platform}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

build_platform() {
  local locale="$1"
  local platform="$2"

  echo ""
  echo "########## ${locale} / ${platform} - tracked ##########"
  for ch in "${TRACKED_CHANNELS[@]}"; do
    build_variant "$locale" "$ch" "true" "$platform"
  done

  echo ""
  echo "########## ${locale} / ${platform} - untracked ##########"
  for ch in "${UNTRACKED_CHANNELS[@]}"; do
    build_variant "$locale" "$ch" "false" "$platform"
  done
}

TARGET_UPPER="$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')"
SELECTED_PLATFORMS=("${DELIVERY_PLATFORMS[@]}")
if [ -n "$PLATFORM_FILTER" ]; then
  PLATFORM_LOWER="$(echo "$PLATFORM_FILTER" | tr '[:upper:]' '[:lower:]')"
  PLATFORM_FOUND=false
  for platform in "${DELIVERY_PLATFORMS[@]}"; do
    if [ "$platform" = "$PLATFORM_LOWER" ]; then
      SELECTED_PLATFORMS=("$PLATFORM_LOWER")
      PLATFORM_FOUND=true
      break
    fi
  done
  if [ "$PLATFORM_FOUND" != "true" ]; then
    echo "Unknown delivery platform: $PLATFORM_FILTER"
    echo "Configured: ${DELIVERY_PLATFORMS[*]}"
    exit 1
  fi
fi

LOCALES_TO_BUILD=()
case "$TARGET_UPPER" in
  ALL) LOCALES_TO_BUILD=("${BUILD_VERSIONS[@]}") ;;
  *)
    for version in "${BUILD_VERSIONS[@]}"; do
      if [ "$version" = "$TARGET_UPPER" ]; then
        LOCALES_TO_BUILD=("$TARGET_UPPER")
        break
      fi
    done
    if [ "${#LOCALES_TO_BUILD[@]}" -eq 0 ]; then
      echo "Unknown target: $TARGET"
      echo "Usage: $0 [all|$(echo "${BUILD_VERSIONS[@]}" | tr '[:upper:]' '[:lower:]' | tr ' ' '|')] [channel] [universal|android|ios]"
      exit 1
    fi
    ;;
esac

if [ -n "$CHANNEL_FILTER" ]; then
  CH_LOWER="$(echo "$CHANNEL_FILTER" | tr '[:upper:]' '[:lower:]')"
  CHANNEL_FOUND=false
  for ch in "${TRACKED_CHANNELS[@]}" "${UNTRACKED_CHANNELS[@]}"; do
    if [ "$ch" = "$CH_LOWER" ]; then CHANNEL_FOUND=true; break; fi
  done
  if [ "$CHANNEL_FOUND" != "true" ]; then
    echo "Unknown channel: $CHANNEL_FILTER"
    echo "Tracked:   ${TRACKED_CHANNELS[*]}"
    echo "Untracked: ${UNTRACKED_CHANNELS[*]}"
    exit 1
  fi
fi

for locale in "${LOCALES_TO_BUILD[@]}"; do
  for platform in "${SELECTED_PLATFORMS[@]}"; do
    if [ -z "$CHANNEL_FILTER" ]; then
      build_platform "$locale" "$platform"
    else
      for ch in "${TRACKED_CHANNELS[@]}"; do
        if [ "$ch" = "$CH_LOWER" ]; then build_variant "$locale" "$ch" "true" "$platform"; fi
      done
      for ch in "${UNTRACKED_CHANNELS[@]}"; do
        if [ "$ch" = "$CH_LOWER" ]; then build_variant "$locale" "$ch" "false" "$platform"; fi
      done
    fi
  done
done

echo ""
echo "========================================="
echo "  Build complete!"
echo "  Success: ${BUILD_COUNT}  Failed: ${FAIL_COUNT}"
echo "========================================="

echo ""
echo "  产物列表:"
for ver in "${BUILD_VERSIONS[@]}"; do
  find "dist/${ver}" -type f -name '*.html' -print 2>/dev/null | sed 's#^#  #' || true
done

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
