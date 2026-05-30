import 'package:flutter/material.dart';
import '../services/supabase_service.dart';
import '../models/employee.dart';

class AuthProvider extends ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();

  bool _isLoading = false;
  String? _errorMessage;
  Employee? _currentEmployee;
  String _role = 'employee';

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Employee? get currentEmployee => _currentEmployee;
  String get role => _role;
  bool get isAuthenticated => _supabaseService.currentUser != null;

  // Initialize and check active session
  Future<void> checkActiveSession() async {
    _isLoading = true;
    notifyListeners();

    if (isAuthenticated) {
      await _fetchProfileAndRole();
    }

    _isLoading = false;
    notifyListeners();
  }

  // Handle Log In
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    print("🚀 Attempting login for: $email");
    try {
      await _supabaseService.signIn(email, password);
      print("✅ Login successful, fetching profile...");
      await _fetchProfileAndRole();
      
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      print("❌ Login error: $e");
      _errorMessage = e.toString().replaceAll("Exception:", "").trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Handle Log Out
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _supabaseService.signOut();
    _currentEmployee = null;
    _role = 'employee';
    _errorMessage = null;

    _isLoading = false;
    notifyListeners();
  }

  // Fetch Linked Profile & Role
  Future<void> _fetchProfileAndRole() async {
    _currentEmployee = await _supabaseService.getLinkedEmployeeProfile();
    _role = await _supabaseService.getUserRole();
  }

  // Clear Error
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
