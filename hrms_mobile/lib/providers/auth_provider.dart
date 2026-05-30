import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';
import '../models/employee.dart';

class AuthProvider extends ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();

  bool _isLoading = false;
  String? _errorMessage;
  Employee? _currentEmployee;
  String _role = 'employee';

  // Supabase Real-time channel for profile synchronizations
  RealtimeChannel? _profileChannel;

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
      if (_currentEmployee != null) {
        subscribeToRealtimeProfile(_currentEmployee!.email);
      }
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
      
      if (_currentEmployee != null) {
        subscribeToRealtimeProfile(_currentEmployee!.email);
      }

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

    disposeProfileChannel();
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

  // ====================================================================
  // SUPABASE REALTIME PROFILE SUBSCRIPTION HELPERS
  // ====================================================================
  void subscribeToRealtimeProfile(String email) {
    _profileChannel?.unsubscribe();

    try {
      _profileChannel = _supabaseService.client
          .channel('public:employees:email=eq.$email')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'employees',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'email',
              value: email,
            ),
            callback: (payload) {
              print("⚡ Real-time database employee profile update received!");
              _fetchProfileSilently();
            },
          );
          
      _profileChannel?.subscribe();
      print("📡 Subscribed to Supabase Realtime profile updates for: $email");
    } catch (e) {
      print("❌ Failed to subscribe to real-time profile: $e");
    }
  }

  Future<void> _fetchProfileSilently() async {
    try {
      _currentEmployee = await _supabaseService.getLinkedEmployeeProfile();
      _role = await _supabaseService.getUserRole();
      notifyListeners();
    } catch (_) {}
  }

  void disposeProfileChannel() {
    try {
      _profileChannel?.unsubscribe();
      _profileChannel = null;
      print("📡 Closed Supabase Real-time profile channels.");
    } catch (_) {}
  }

  @override
  void dispose() {
    disposeProfileChannel();
    super.dispose();
  }
}
