const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for TypeScript path mapping
config.resolver.alias = {
    '@': __dirname,
    '@/components': __dirname + '/components',
    '@/constants': __dirname + '/constants',
    '@/hooks': __dirname + '/hooks',
    '@/idl': __dirname + '/idl',
    '@/utils': __dirname + '/utils',
};

module.exports = config;
