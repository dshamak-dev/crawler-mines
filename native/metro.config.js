const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const nativeNodeModules = path.resolve(projectRoot, 'node_modules');

function tryResolveDir(pkg, fromDir) {
  try {
    return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [fromDir] }));
  } catch {
    return null;
  }
}

function findInPnpmStore(pkg) {
  const pnpmRoot = path.join(nativeNodeModules, '.pnpm');
  if (!fs.existsSync(pnpmRoot)) return null;

  let entries;
  try {
    entries = fs.readdirSync(pnpmRoot);
  } catch {
    return null;
  }

  const storeName = pkg.startsWith('@') ? pkg.replace('/', '+') : pkg;
  const preferred = entries.filter(
    (entry) => entry.startsWith(`${storeName}@`) || entry.startsWith('expo-router@'),
  );
  const search = preferred.concat(entries);

  const seen = new Set();
  for (const entry of search) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    const candidate = path.join(pnpmRoot, entry, 'node_modules', pkg);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  return null;
}

function resolveNativePackage(pkg) {
  if (fs.existsSync(path.join(nativeNodeModules, pkg, 'package.json'))) {
    return path.join(nativeNodeModules, pkg);
  }
  return tryResolveDir(pkg, projectRoot) || findInPnpmStore(pkg);
}

const config = getDefaultConfig(projectRoot);

// Share the web engine + Zustand store without moving the Vite app.
config.watchFolders = [
  path.join(workspaceRoot, 'src', 'engine'),
  path.join(workspaceRoot, 'src', 'store'),
];

// pnpm isolates Expo Router's @expo/metro-runtime under .pnpm/. Metro's
// default lookup only searches native/node_modules, which is why
// `import '@expo/metro-runtime'` from entry-classic.js fails. Map it
// explicitly (and keep hierarchical lookup for other nested peers).
const extraNodeModules = { ...(config.resolver.extraNodeModules || {}) };
const metroRuntime = resolveNativePackage('@expo/metro-runtime');
if (metroRuntime) {
  extraNodeModules['@expo/metro-runtime'] = metroRuntime;
}
config.resolver.extraNodeModules = extraNodeModules;
config.resolver.nodeModulesPaths = [nativeNodeModules];
config.resolver.disableHierarchicalLookup = false;

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    metroRuntime &&
    (moduleName === '@expo/metro-runtime' || moduleName.startsWith('@expo/metro-runtime/'))
  ) {
    const suffix = moduleName.slice('@expo/metro-runtime'.length).replace(/^\//, '');
    const target = suffix ? path.join(metroRuntime, suffix) : metroRuntime;
    return context.resolveRequest(context, target, platform);
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Block the Vite root node_modules (different React) without hiding pnpm nests.
const rootNm = path.resolve(workspaceRoot, 'node_modules').replace(/[/\\]/g, '[/\\\\]');
const parentBlock = new RegExp(`^${rootNm}[/\\\\].*`);
const existing = config.resolver.blockList;
config.resolver.blockList = existing ? [existing, parentBlock].flat() : parentBlock;

module.exports = config;
