#!/bin/bash

echo "🚀 Setting up Caden Mobile App"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Install Expo CLI if not already installed
if ! command -v expo &> /dev/null; then
    echo "📱 Installing Expo CLI..."
    npm install -g @expo/cli
fi

echo "✅ Expo CLI is available"

# Check if Android Studio is installed (for Android development)
if command -v adb &> /dev/null; then
    echo "✅ Android SDK is available"
else
    echo "⚠️  Android SDK not found. Install Android Studio for Android development."
fi

# Check if Xcode is installed (for iOS development on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v xcode-select &> /dev/null; then
        echo "✅ Xcode is available"
    else
        echo "⚠️  Xcode not found. Install Xcode for iOS development."
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Run on Android: npm run android"
echo "3. Run on iOS: npm run ios"
echo "4. Build APK: npm run android:build"
echo ""
echo "For more information, see README.md"
