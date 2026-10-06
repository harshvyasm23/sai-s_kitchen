import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { lightColors, darkColors } from '@/constants/colors';
import { borderRadius, shadows } from '@/constants/theme';

export default function ThemeToggle() {
  const { themeMode, isDark, updateThemeMode } = useTheme();
  const colors = isDark ? darkColors : lightColors;

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'auto'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    updateThemeMode(modes[nextIndex]);
  };

  const getIcon = () => {
    switch (themeMode) {
      case 'light':
        return <Sun size={20} color={colors.text} />;
      case 'dark':
        return <Moon size={20} color={colors.text} />;
      case 'auto':
        return <Monitor size={20} color={colors.text} />;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={cycleTheme}
    >
      <View style={styles.iconContainer}>
        {getIcon()}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadows.sm,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
