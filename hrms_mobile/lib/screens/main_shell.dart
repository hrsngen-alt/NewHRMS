import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import 'dashboard_screen.dart';
import 'attendance_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({Key? key}) : super(key: key);

  static final ValueNotifier<int> selectedIndexNotifier = ValueNotifier<int>(0);

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const AttendanceScreen(),
    const ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    MainShell.selectedIndexNotifier.value = 0;
    MainShell.selectedIndexNotifier.addListener(_onTabChanged);
    // Pre-fetch initial logs for the authenticated employee
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.currentEmployee != null) {
        Provider.of<AttendanceProvider>(context, listen: false).fetchAttendanceLogs(
          auth.role,
          auth.currentEmployee!.id,
        );
      }
    });
  }

  void _onTabChanged() {
    if (mounted) {
      setState(() {
        _selectedIndex = MainShell.selectedIndexNotifier.value;
      });
    }
  }

  @override
  void dispose() {
    MainShell.selectedIndexNotifier.removeListener(_onTabChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      body: IndexedStack(
        index: _selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: Colors.white.withOpacity(0.06),
              width: 1,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          backgroundColor: const Color(0xFF0F172A),
          selectedItemColor: const Color(0xFF818CF8), // Indigo light
          unselectedItemColor: Colors.white.withOpacity(0.3),
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 0.5),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5),
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: "DASHBOARD",
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.alarm_on_outlined),
              activeIcon: Icon(Icons.alarm_on_rounded),
              label: "ATTENDANCE",
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: "PROFILE",
            ),
          ],
        ),
      ),
    );
  }
}
