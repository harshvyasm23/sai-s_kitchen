import { View, Image, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { fontSize, fontWeight } from '@/constants/theme';
import { ChefHat } from 'lucide-react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const dimensions = {
    small: 40,
    medium: 80,
    large: 120,
  };

  const textSizes = {
    small: fontSize.md,
    medium: fontSize.xl,
    large: fontSize.xxxl,
  };

  const logoUri = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zatop184vuk21k40jn3mc';

  return (
    <View style={styles.container}>
      {logoUri ? (
        <Image
          source={{ uri: logoUri }}
          style={[styles.logo, { width: dimensions[size], height: dimensions[size] }]}
          resizeMode="contain"
          onError={(e) => {
            console.log('Logo image failed to load:', e.nativeEvent.error);
          }}
        />
      ) : (
        <View style={[styles.logoFallback, { width: dimensions[size], height: dimensions[size], backgroundColor: colors.primary }]}>
          <ChefHat size={dimensions[size] * 0.6} color={colors.surface} />
        </View>
      )}
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, { fontSize: textSizes[size], color: colors.text }]}>
            Sai&apos;s Kitchen
          </Text>
          <Text style={[styles.subtitle, { fontSize: textSizes[size] * 0.5, color: colors.textSecondary }]}>
            Tiffin Service • Catering
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginBottom: 8,
  },
  logoFallback: {
    marginBottom: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: fontWeight.medium,
  },
});
