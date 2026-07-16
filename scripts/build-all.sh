#!/usr/bin/env bash
#
# 批量构建所有 语言×渠道×埋点 组合。
#
# 配置来源:
#   package.json appConfig.i18n.buildVersions
#   package.json appConfig.i18n.channels
#   package.json appConfig.naming
#
# 用法:
#   ./scripts/build-all.sh                  # 构建全部
#   ./scripts/build-all.sh en               # 只构建 EN 全部渠道
#   ./scripts/build-all.sh tw applovin      # 只构建 TW + applovin（有埋点+无埋点）
#
# 输出:
#   dist/EN/tracked/<命名>.html
#   dist/EN/untracked/<命名>.html
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

read_json() {
  node -e "const p=require('./package.json'); console.log($1)"
}

IFS=' ' read -ra TRACKED_CHANNELS <<< "$(read_json "p.appConfig.i18n.channels.tracked.join(' ')")"
IFS=' ' read -ra UNTRACKED_CHANNELS <<< "$(read_json "p.appConfig.i18n.channels.untracked.join(' ')")"
IFS=' ' read -ra BUILD_VERSIONS <<< "$(read_json "p.appConfig.i18n.buildVersions.join(' ')")"
IFS=' ' read -ra ALL_LOCALES <<< "$(read_json "Object.keys(p.appConfig.i18n.locales).join(' ')")"

PROJECT_CODE="$(read_json "p.appConfig.naming.projectCode")"
MATERIAL_ID="$(read_json "p.appConfig.naming.materialId")"
CREATOR="$(read_json "p.appConfig.naming.creator")"
VENDOR="$(read_json "p.appConfig.naming.vendor")"
MATERIAL_NAME="$(read_json "p.appConfig.naming.materialName")"
DEFAULT_CHANNEL="$(read_json "p.appConfig.analytics.adNetwork || 'applovin'")"
BUILD_DATE=$(date +%Y%m%d)

TARGET="${1:-all}"
CHANNEL_FILTER="${2:-}"
BUILD_COUNT=0
FAIL_COUNT=0

make_filename() {
  local locale="$1"
  local channel="$2"
  local tracking="$3"
  local base="${PROJECT_CODE}_${MATERIAL_ID}_${locale}_${CREATOR}_${BUILD_DATE}_${VENDOR}_${channel}_${MATERIAL_NAME}"

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
  local track_dir
  if [ "$tracking" = "true" ]; then track_dir="tracked"; else track_dir="untracked"; fi

  local filename
  filename=$(make_filename "$locale" "$channel" "$tracking")
  local out_dir="dist/${locale}/${track_dir}"

  echo "========================================="
  echo "  Building: ${track_dir}  LOCALE=${locale}  CHANNEL=${channel}"
  echo "  -> ${out_dir}/${filename}"
  echo "========================================="

  rm -rf "dist/_build"

  if LOCALE="$locale" CHANNEL="$channel" TRACKING="$tracking" BUILD_MATRIX=true SCENE_WALKTHROUGH_BUILD=false npm run typecheck && LOCALE="$locale" CHANNEL="$channel" TRACKING="$tracking" BUILD_MATRIX=true SCENE_WALKTHROUGH_BUILD=false npx vite build && node scripts/check-scene-walkthrough-build.mjs --disabled dist/_build/index.html && npm run check:prod-debug; then
    mkdir -p "$out_dir"
    mv "dist/_build/index.html" "${out_dir}/${filename}"

    # Keep one stable visual/raw Rollup report for bundle diagnosis. The
    # representative build is EN + tracked + the project's default channel;
    # later variants must not overwrite it.
    if [ "${BUNDLE_STATS:-false}" = "true" ] && [ "$locale" = "EN" ] && [ "$tracking" = "true" ] && [ "$channel" = "$DEFAULT_CHANNEL" ]; then
      test -f "dist/_build/stats.html"
      test -f "dist/_build/stats.json"
      mv "dist/_build/stats.html" "dist/stats.html"
      mv "dist/_build/stats.json" "dist/stats.json"
    fi

    rm -rf "dist/_build"
    BUILD_COUNT=$((BUILD_COUNT + 1))
  else
    echo "  [FAILED] ${track_dir} LOCALE=${locale} CHANNEL=${channel}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

build_locale() {
  local locale="$1"

  echo ""
  echo "########## ${locale} - tracked ##########"
  for ch in "${TRACKED_CHANNELS[@]}"; do
    build_variant "$locale" "$ch" "true"
  done

  echo ""
  echo "########## ${locale} - untracked ##########"
  for ch in "${UNTRACKED_CHANNELS[@]}"; do
    build_variant "$locale" "$ch" "false"
  done
}

TARGET_UPPER="$(echo "$TARGET" | tr '[:lower:]' '[:upper:]')"

if [ -n "$CHANNEL_FILTER" ] && [ "$TARGET_UPPER" != "ALL" ]; then
  FOUND=false
  for loc in "${ALL_LOCALES[@]}"; do
    if [ "$loc" = "$TARGET_UPPER" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" != "true" ]; then
    echo "Unknown locale: $TARGET"
    echo "Available: $(echo "${ALL_LOCALES[@]}" | tr '[:upper:]' '[:lower:]' | tr ' ' '|')"
    exit 1
  fi

  CH_LOWER="$(echo "$CHANNEL_FILTER" | tr '[:upper:]' '[:lower:]')"

  for ch in "${TRACKED_CHANNELS[@]}"; do
    if [ "$ch" = "$CH_LOWER" ]; then
      build_variant "$TARGET_UPPER" "$CH_LOWER" "true"
    fi
  done

  for ch in "${UNTRACKED_CHANNELS[@]}"; do
    if [ "$ch" = "$CH_LOWER" ]; then
      build_variant "$TARGET_UPPER" "$CH_LOWER" "false"
    fi
  done

  if [ "$BUILD_COUNT" -eq 0 ] && [ "$FAIL_COUNT" -eq 0 ]; then
    echo "Unknown channel: $CHANNEL_FILTER"
    echo "Tracked:   ${TRACKED_CHANNELS[*]}"
    echo "Untracked: ${UNTRACKED_CHANNELS[*]}"
    exit 1
  fi
else
  case "$TARGET_UPPER" in
    ALL)
      for ver in "${BUILD_VERSIONS[@]}"; do
        build_locale "$ver"
      done
      ;;
    *)
      FOUND=false
      for ver in "${BUILD_VERSIONS[@]}"; do
        if [ "$ver" = "$TARGET_UPPER" ]; then
          FOUND=true
          break
        fi
      done
      if [ "$FOUND" = "true" ]; then
        build_locale "$TARGET_UPPER"
      else
        echo "Unknown target: $TARGET"
        echo "Usage: $0 [all|$(echo "${BUILD_VERSIONS[@]}" | tr '[:upper:]' '[:lower:]' | tr ' ' '|')]"
        echo "       $0 <locale> <channel>"
        exit 1
      fi
      ;;
  esac
fi

echo ""
echo "========================================="
echo "  Build complete!"
echo "  Success: ${BUILD_COUNT}  Failed: ${FAIL_COUNT}"
echo "========================================="

echo ""
echo "  产物列表:"
for ver in "${BUILD_VERSIONS[@]}"; do
  if [ -d "dist/${ver}/tracked" ]; then
    echo "  --- ${ver}/tracked ---"
    ls -1 "dist/${ver}/tracked/" 2>/dev/null | sed 's/^/    /'
  fi
  if [ -d "dist/${ver}/untracked" ]; then
    echo "  --- ${ver}/untracked ---"
    ls -1 "dist/${ver}/untracked/" 2>/dev/null | sed 's/^/    /'
  fi
done

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
