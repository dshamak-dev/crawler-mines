const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Share the web engine + Zustand store without moving the Vite app.
config.watchFolders = [
  path.join(workspaceRoot, 'src', 'engine'),
  path.join(workspaceRoot, 'src', 'store'),
];

// Resolve packages from native/ first. Do not disable hierarchical lookup —
// pnpm nests Expo Router peers (e.g. @expo/metro-runtime) and Metro must
// walk those folders. Block the Vite root node_modules instead (different React).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
const rootNm = path.resolve(workspaceRoot, 'node_modules').replace(/[/\\]/g, '[/\\\\]');
const parentBlock = new RegExp(`^${rootNm}[/\\\\].*`);
const existing = config.resolver.blockList;
config.resolver.blockList = existing ? [existing, parentBlock].flat() : parentBlock;

module.exports = config;
