import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function GuidedTour() {
  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem('has_seen_tour');
    if (hasSeenTour) return;

    // Wait a brief moment for the DOM to fully render and animations to settle
    const timeout = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        steps: [
          {
            element: 'body',
            popover: {
              title: 'Welcome to SN Gene HRMS! 🎉',
              description: 'Let us take you on a quick tour to show you around your new workspace. It will only take a minute!',
              side: "center", 
              align: 'center'
            }
          },
          {
            element: 'header button[title*="Search"]',
            popover: {
              title: 'Global Search',
              description: 'Press Ctrl+K (or Cmd+K) or click here to jump to any module instantly.',
              side: "bottom", 
              align: 'start'
            }
          },
          {
            element: '.md\\:hidden.fixed.bottom-0', // Targets the Mobile Bottom Nav (if visible)
            popover: {
              title: 'Navigation Bar',
              description: 'Use this bar to quickly access your attendance, leaves, and profile.',
              side: "top", 
              align: 'center'
            }
          },
          {
            element: 'aside', // Desktop Sidebar
            popover: {
              title: 'Main Menu',
              description: 'All your HR modules are neatly organized here. Managers and Admins will see extra tools.',
              side: "right", 
              align: 'start'
            }
          }
        ],
        onDestroyStarted: () => {
          localStorage.setItem('has_seen_tour', 'true');
          driverObj.destroy();
        },
      });

      driverObj.drive();
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
