import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = "theme_is_dark";
  bool _isDark = true; // Default to sleek Slate Dark Mode

  bool get isDark => _isDark;

  ThemeProvider() {
    _loadThemeFromPrefs();
  }

  // Toggle Theme
  void toggleTheme() async {
    _isDark = !_isDark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_themeKey, _isDark);
  }

  // Set Explicit Theme
  void setTheme(bool isDark) async {
    _isDark = isDark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_themeKey, _isDark);
  }

  // Load from Local Preferences
  Future<void> _loadThemeFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _isDark = prefs.getBool(_themeKey) ?? true;
      notifyListeners();
    } catch (_) {
      // Fallback if preferences fail
      _isDark = true;
    }
  }
}
