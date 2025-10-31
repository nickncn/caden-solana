import { useState, useEffect } from 'react';
import { Platform, Dimensions, ScaledSize } from 'react-native';

interface ResponsiveState {
    isDesktop: boolean;
    isTablet: boolean;
    isMobile: boolean;
    width: number;
    height: number;
}

export function useResponsive(): ResponsiveState {
    const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions(window);
        });

        return () => subscription?.remove();
    }, []);

    const width = dimensions.width;
    const height = dimensions.height;

    // Desktop: > 1024px, Tablet: 768-1024px, Mobile: < 768px
    const isDesktop = Platform.OS === 'web' && width > 1024;
    const isTablet = width > 768 && width <= 1024;
    const isMobile = width <= 768 || Platform.OS !== 'web';

    return {
        isDesktop,
        isTablet,
        isMobile,
        width,
        height,
    };
}

// Helper function for responsive max-width container styles
export function getContainerStyle(maxWidth: number = 1200) {
    return {
        maxWidth,
        width: '100%',
        alignSelf: 'center' as const,
        paddingHorizontal: Platform.OS === 'web' ? 40 : 20,
    };
}

