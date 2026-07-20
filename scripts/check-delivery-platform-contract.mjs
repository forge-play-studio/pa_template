import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const scene = JSON.parse(readFileSync(resolve('src/config/scene.json'), 'utf8'));
const viteConfig = readFileSync(resolve('vite-plugins/projectViteConfig.ts'), 'utf8');
const buildScript = readFileSync(resolve('scripts/build-all.sh'), 'utf8');
const ctaService = readFileSync(resolve('src/services/PlayableCtaService.ts'), 'utf8');

const failures = [];

if (JSON.stringify(packageJson.appConfig?.delivery?.platforms) !== JSON.stringify(['universal'])) {
  failures.push('appConfig.delivery.platforms must default to ["universal"]');
}

if (packageJson.appConfig?.naming?.vendor !== 'ForgePlay') {
  failures.push('appConfig.naming.vendor must be the template-managed value ForgePlay');
}

const cta = scene.meta?.playableAdInfo?.cta;
if (cta?.mode !== 'smart-link' || typeof cta?.androidUrl !== 'string' || typeof cta?.iosUrl !== 'string') {
  failures.push('scene playableAdInfo must expose the compatible smart-link and Android/iOS CTA fields');
}

for (const marker of [
  "__TARGET_PLATFORM__",
  "TARGET_PLATFORM must be universal, android, or ios",
]) {
  if (!viteConfig.includes(marker)) failures.push(`Vite config is missing ${marker}`);
}

for (const marker of [
  'DELIVERY_PLATFORMS',
  'TARGET_PLATFORM="$platform"',
  'out_dir="${out_dir}/${platform}"',
  'FIXED_VENDOR="ForgePlay"',
  'appConfig.naming.vendor is template-managed',
]) {
  if (!buildScript.includes(marker)) failures.push(`build-all.sh is missing ${marker}`);
}

for (const marker of [
  "cta?.mode === 'platform-build'",
  'readRuntimeTargetPlatform',
  'cta.androidUrl',
  'cta.iosUrl',
]) {
  if (!ctaService.includes(marker)) failures.push(`PlayableCtaService is missing ${marker}`);
}

if (failures.length > 0) {
  console.error('[check-delivery-platform-contract] Failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[check-delivery-platform-contract] OK');
