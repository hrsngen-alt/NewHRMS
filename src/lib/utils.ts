import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDeviceInfo() {
  if (typeof window === "undefined" || !window.navigator) return {};
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.indexOf("Firefox") > -1) browser = "Firefox";
  else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
  else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
  else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
  else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Microsoft Edge";
  else if (ua.indexOf("Chrome") > -1) browser = "Google Chrome";
  else if (ua.indexOf("Safari") > -1) browser = "Apple Safari";

  if (ua.indexOf("Windows NT 10.0") > -1) os = "Windows 10/11";
  else if (ua.indexOf("Windows NT 6.2") > -1) os = "Windows 8";
  else if (ua.indexOf("Windows NT 6.1") > -1) os = "Windows 7";
  else if (ua.indexOf("Macintosh") > -1) os = "macOS";
  else if (ua.indexOf("iPhone") > -1) os = "iOS (iPhone)";
  else if (ua.indexOf("iPad") > -1) os = "iOS (iPad)";
  else if (ua.indexOf("Android") > -1) os = "Android";
  else if (ua.indexOf("Linux") > -1) os = "Linux";

  return {
    browser,
    os,
    userAgent: ua,
    platform: (navigator as any).platform || "unknown"
  };
}

export async function fetchAddress(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: {
        'User-Agent': 'PulseHRMS-Attendance/1.0'
      }
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.address) {
      const parts = [
        data.address.road || data.address.suburb,
        data.address.city || data.address.town || data.address.village,
        data.address.state,
        data.address.postcode
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : data.display_name || "Location resolved";
    }
    return data.display_name || "Location resolved";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Coordinates: " + lat.toFixed(4) + ", " + lng.toFixed(4);
  }
}
