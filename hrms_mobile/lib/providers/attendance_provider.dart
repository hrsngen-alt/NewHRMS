import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';
import '../services/location_service.dart';
import '../services/offline_sync_service.dart';
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

  // Supabase Real-time variables for website-mobile syncing
  String? _subscribedEmployeeId;
  RealtimeChannel? _realtimeChannel;

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

    // 1. Establish Real-time Subscription to receive instant check-ins from the website
    subscribeToRealtimeAttendance(employeeId);

    // 2. Attempt dynamic background synchronization of any pending punches
    try {
      await OfflineSyncService().syncPendingPunches();
    } catch (_) {}

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

  // Punch In Action (Supporting Offline Check-ins)
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

      // 2. Punch in database or fallback to offline cache
      try {
        await _supabaseService.punchIn(employeeId, position.latitude, position.longitude, isFieldMode);
        
        // 3. Refresh logs
        await fetchAttendanceLogs('employee', employeeId);
      } catch (e) {
        final errorStr = e.toString();
        // If it's a network issue, register offline punch
        if (errorStr.contains("Failed host lookup") || errorStr.contains("SocketException") || errorStr.contains("ClientException")) {
          final now = DateTime.now().toUtc();
          final todayStr = DateTime.now().toIso8601String().substring(0, 10);

          await OfflineSyncService().savePendingPunch({
            'type': 'in',
            'employee_id': employeeId,
            'lat': position.latitude,
            'lng': position.longitude,
            'is_field': isFieldMode,
            'timestamp': now.toIso8601String(),
          });

          // Generate offline visual active shift
          _activeShift = Attendance(
            id: 'offline_shift',
            employeeId: employeeId,
            date: todayStr,
            checkIn: now,
            status: 'present',
            checkInLat: position.latitude,
            checkInLng: position.longitude,
            metadata: const {'is_offline': true},
          );
          _isClockedIn = true;
          _records.insert(0, _activeShift!);
          _startTimer();

          _isLoading = false;
          notifyListeners();
          return true; // Successfully clocked in (cached offline!)
        } else {
          rethrow;
        }
      }
      
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

  // Punch Out Action (Supporting Offline Check-outs)
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

      // 2. Update database check-out or fallback to offline cache
      try {
        if (_activeShift!.id == 'offline_shift') {
          throw Exception("SocketException: Force offline check-out");
        }
        
        await _supabaseService.punchOut(
          _activeShift!.id, 
          _activeShift!.checkIn, 
          position.latitude, 
          position.longitude
        );

        _stopTimer();
        _activeShift = null;
        _isClockedIn = false;
        
        // Refresh logs
        await fetchAttendanceLogs('employee', employeeId);
      } catch (e) {
        final errorStr = e.toString();
        if (errorStr.contains("SocketException") || errorStr.contains("Failed host lookup") || errorStr.contains("ClientException")) {
          final now = DateTime.now().toUtc();
          
          await OfflineSyncService().savePendingPunch({
            'type': 'out',
            'employee_id': employeeId,
            'lat': position.latitude,
            'lng': position.longitude,
            'timestamp': now.toIso8601String(),
          });

          _stopTimer();
          _activeShift = null;
          _isClockedIn = false;

          // Try refreshing logs in background
          try {
            await fetchAttendanceLogs('employee', employeeId);
          } catch (_) {}

          _isLoading = false;
          notifyListeners();
          return true; // Successfully clocked out (cached offline!)
        } else {
          rethrow;
        }
      }

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

  // ====================================================================
  // SUPABASE REALTIME SUBSCRIPTION HELPERS
  // ====================================================================
  void subscribeToRealtimeAttendance(String employeeId) {
    if (_subscribedEmployeeId == employeeId) return; // Already subscribed to this employee
    
    _subscribedEmployeeId = employeeId;
    _realtimeChannel?.unsubscribe();

    try {
      _realtimeChannel = _supabaseService.client
          .channel('public:attendance:employee_id=eq.$employeeId')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'attendance',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'employee_id',
              value: employeeId,
            ),
            callback: (payload) {
              print("⚡ Real-time database update detected! Event: ${payload.eventType}");
              // Force background refresh to update timers instantly on check-in / out
              _refreshLogsSilently(employeeId);
            },
          );
          
      _realtimeChannel?.subscribe();
      print("📡 Established active Supabase Real-time connection for employee: $employeeId");
    } catch (e) {
      print("❌ Error setting up Supabase Realtime subscription: $e");
    }
  }

  // Silent refresh updating clocks without flashing loaders on screen
  Future<void> _refreshLogsSilently(String employeeId) async {
    try {
      _records = await _supabaseService.getCachedAttendance('employee', employeeId);
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
      notifyListeners();
    } catch (e) {
      print("❌ Realtime silent refresh failed: $e");
    }
  }

  void disposeRealtimeChannel() {
    try {
      _realtimeChannel?.unsubscribe();
      _realtimeChannel = null;
      _subscribedEmployeeId = null;
      print("📡 Closed Supabase Real-time attendance channels.");
    } catch (_) {}
  }

  @override
  void dispose() {
    _shiftTimer?.cancel();
    disposeRealtimeChannel();
    super.dispose();
  }
}
