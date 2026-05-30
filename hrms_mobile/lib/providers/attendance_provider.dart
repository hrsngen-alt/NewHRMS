import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/supabase_service.dart';
import '../services/location_service.dart';
import '../models/attendance.dart';

class AttendanceProvider extends ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();
  final LocationService _locationService = LocationService();

  List<Attendance> _records = [];
  bool _isLoading = false;
  String? _errorMessage;

  // Active shift clock state
  Attendance? _activeShift;
  bool _isClockedIn = false;
  String _elapsedTime = "00:00:00";
  Timer? _shiftTimer;

  List<Attendance> get records => _records;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Attendance? get activeShift => _activeShift;
  bool get isClockedIn => _isClockedIn;
  String get elapsedTime => _elapsedTime;

  // Fetch cached records
  Future<void> fetchAttendanceLogs(String role, String employeeId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _records = await _supabaseService.getCachedAttendance(role, employeeId);
      
      // Determine if there is a currently running active shift (check_out is null)
      final todayStr = DateTime.now().toIso8601String().substring(0, 10);
      final todayRecords = _records.where((r) => r.date == todayStr).toList();
      
      if (todayRecords.isNotEmpty && todayRecords.first.isActive) {
        _activeShift = todayRecords.first;
        _isClockedIn = true;
        _startTimer();
      } else {
        _activeShift = null;
        _isClockedIn = false;
        _stopTimer();
      }
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Punch In Action
  Future<bool> checkIn(String employeeId, bool isFieldMode) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Get native coordinates
      final Position? position = await _locationService.getCurrentCoordinates();
      if (position == null) {
        throw Exception("Failed to retrieve high-accuracy GPS coordinates. Please ensure location services and permissions are fully enabled.");
      }

      // 2. Punch in database
      await _supabaseService.punchIn(employeeId, position.latitude, position.longitude, isFieldMode);
      
      // 3. Refresh logs
      await fetchAttendanceLogs('employee', employeeId);
      
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll("Exception:", "").trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Punch Out Action
  Future<bool> checkOut(String employeeId) async {
    if (_activeShift == null) return false;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Get native coordinates
      final Position? position = await _locationService.getCurrentCoordinates();
      if (position == null) {
        throw Exception("Failed to retrieve high-accuracy GPS coordinates for clock-out.");
      }

      // 2. Update database check-out
      await _supabaseService.punchOut(
        _activeShift!.id, 
        _activeShift!.checkIn, 
        position.latitude, 
        position.longitude
      );

      // 3. Stop timer and clear active shift state
      _stopTimer();
      _activeShift = null;
      _isClockedIn = false;

      // 4. Refresh logs
      await fetchAttendanceLogs('employee', employeeId);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll("Exception:", "").trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Handle active shift timer
  void _startTimer() {
    _shiftTimer?.cancel();
    _shiftTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_activeShift != null) {
        final diff = DateTime.now().difference(_activeShift!.checkIn.toLocal());
        final hours = diff.inHours.toString().padLeft(2, '0');
        final minutes = (diff.inMinutes % 60).toString().padLeft(2, '0');
        final seconds = (diff.inSeconds % 60).toString().padLeft(2, '0');
        _elapsedTime = "$hours:$minutes:$seconds";
        notifyListeners();
      }
    });
  }

  void _stopTimer() {
    _shiftTimer?.cancel();
    _elapsedTime = "00:00:00";
  }

  @override
  void dispose() {
    _shiftTimer?.cancel();
    super.dispose();
  }
}
