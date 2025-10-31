// React Native polyfills for browser APIs

// structuredClone polyfill - this is the main one we need
if (typeof global.structuredClone === 'undefined') {
    global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Buffer polyfill for React Native
if (typeof global.Buffer === 'undefined') {
    global.Buffer = require('buffer').Buffer;
}

// crypto.getRandomValues polyfill for React Native
if (typeof global.crypto === 'undefined') {
    global.crypto = {};
}

if (typeof global.crypto.getRandomValues === 'undefined') {
    try {
        const crypto = require('expo-crypto');
        global.crypto.getRandomValues = (array) => {
            const randomBytes = crypto.getRandomBytes(array.length);
            for (let i = 0; i < array.length; i++) {
                array[i] = randomBytes[i];
            }
            return array;
        };
    } catch (error) {
        // Fallback to Math.random if expo-crypto fails
        global.crypto.getRandomValues = (array) => {
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
            return array;
        };
    }
}
