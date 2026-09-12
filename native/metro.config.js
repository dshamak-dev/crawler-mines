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

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
// Keep Vite's root node_modules (different React) out of this bundle.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
