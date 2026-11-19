const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../shared')];

const normPath = (p) => {
  const sl = String(p || '').replace(/\\/g, '/');
  return process.platform === 'win32' ? sl.toLowerCase() : sl;
};
const appSrcDir = normPath(path.resolve(__dirname, 'src'));
const appI18nDir = normPath(path.resolve(__dirname, 'src/i18n'));
const translatedRnPath = path.resolve(__dirname, 'src/i18n/reactNativeTranslated.ts');
// On web, babel-preset-expo rewrites `import { Text } from 'react-native'` into
// `react-native-web/dist/exports/Text`, bypassing the `react-native` redirect above.
const WEB_TRANSLATED_EXPORTS = new Set(['Text', 'TextInput', 'Alert', 'Share', 'Animated', 'Button', 'RefreshControl']);
const webShimDir = path.resolve(__dirname, 'src/i18n/webShims');
const previousResolveRequest = config.resolver?.resolveRequest;

const isAppSourceOrigin = (originModulePath) => {
  const origin = normPath(originModulePath);
  return origin.startsWith(`${appSrcDir}/`) && !origin.startsWith(`${appI18nDir}/`);
};

config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if ((moduleName === 'react-native' || moduleName === 'react-native-web') && isAppSourceOrigin(context.originModulePath)) {
    return {
      type: 'sourceFile',
      filePath: translatedRnPath,
    };
  }
  const webExport = /^react-native-web\/dist\/(?:cjs\/)?exports\/([A-Za-z]+)(?:\/index(?:\.js)?)?$/.exec(moduleName);
  if (webExport && WEB_TRANSLATED_EXPORTS.has(webExport[1]) && isAppSourceOrigin(context.originModulePath)) {
    return {
      type: 'sourceFile',
      filePath: path.join(webShimDir, `${webExport[1]}.ts`),
    };
  }
  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
