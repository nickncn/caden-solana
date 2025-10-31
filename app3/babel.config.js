module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            [
                'module-resolver',
                {
                    root: ['./'],
                    alias: {
                        '@': './',
                        '@/components': './components',
                        '@/constants': './constants',
                        '@/hooks': './hooks',
                        '@/idl': './idl',
                        '@/utils': './utils',
                    },
                },
            ],
            'react-native-reanimated/plugin',
        ],
    };
};
