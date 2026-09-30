import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Smartphone, X, Share, PlusSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function PWAInstallManager() {
  const [isIOS, setIsIOS] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [activeGuide, setActiveGuide] = useState<"ios" | "mac" | "chrome" | "apk">("ios");

  useEffect(() => {
    const ua = navigator.userAgent;

    // iOS check
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Android check
    const isAndroidDevice = /Android/i.test(ua);
    setIsAndroid(isAndroidDevice);

    // Mac check
    const isMacDevice = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) && !isIOSDevice;
    setIsMac(isMacDevice);

    // Safari check (must exclude Chrome, Edge, etc.)
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
    setIsSafari(isSafariBrowser);

    // Set initial active guide tab
    if (isIOSDevice) {
      setActiveGuide("ios");
    } else if (isMacDevice) {
      setActiveGuide("mac");
    } else if (isAndroidDevice) {
      setActiveGuide("apk");
    } else {
      setActiveGuide("chrome");
    }

    // Intercept native PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes("android-app://");

      const dismissed = localStorage.getItem("pwa_download_banner_dismissed") === "true";
      if (!dismissed && !isStandalone) {
        setShowBanner(true);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Permanently dismiss the banner since the user clicked to install/guide
    localStorage.setItem("pwa_download_banner_dismissed", "true");
    setShowBanner(false);

    if (isIOS) {
      setActiveGuide("ios");
      setShowInstallGuide(true);
    } else if (isMac && isSafari) {
      setActiveGuide("mac");
      setShowInstallGuide(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("Thank you for installing SN Gene HR!");
        setDeferredPrompt(null);
      }
    } else if (isAndroid) {
      toast.success("Starting APK download...");
      const link = document.createElement("a");
      link.href = "/app-release.apk";
      link.download = "app-release.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setActiveGuide(isMac ? "mac" : "chrome");
      setShowInstallGuide(true);
    }
  };

  const getBannerDetails = () => {
    if (isIOS) {
      return {
        description: "Add to home screen for quick entry and live updates",
        buttonText: "Install App",
      };
    }
    if (isMac) {
      return {
        description: isSafari
          ? "Add SN Gene HR to your Mac Dock for instant access"
          : "Install SN Gene HR App on your Mac",
        buttonText: "Install App",
      };
    }
    if (isAndroid) {
      return {
        description: "Install APK for instant check-in/out on Android",
        buttonText: "Download APK",
      };
    }
    return {
      description: "Install SN Gene HR on your desktop or mobile device",
      buttonText: "Install App",
    };
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("pwa_download_banner_dismissed", "true");
  };

  return (
    <>
      {/* Floating App Download Banner */}
      {showBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-blue-500/20 dark:border-blue-500/10 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-3 min-w-0 pr-8 sm:pr-0">
            <div className="size-11 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Smartphone className="size-6" />
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-black text-sm text-foreground leading-snug">
                Get the SN Gene HR Mobile App
              </h4>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-relaxed">
                {getBannerDetails().description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer text-center"
            >
              {getBannerDetails().buttonText}
            </button>
            <button
              onClick={dismissBanner}
              className="absolute sm:static top-3 right-3 size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Universal Install/Download Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="text-center space-y-1 mb-4">
              <div className="mx-auto size-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                <Smartphone className="size-7" />
              </div>
              <h3 className="font-display font-black text-xl text-foreground mt-2">
                Install SN Gene HR
              </h3>
              <p className="text-xs text-muted-foreground font-medium px-2">
                Choose your device platform to view installation instructions.
              </p>
            </div>

            {/* Custom Tab headers */}
            <div className="grid grid-cols-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-wider mb-6">
              {[
                { id: "ios", label: "iPhone" },
                { id: "mac", label: "Macbook" },
                { id: "chrome", label: "Chrome" },
                { id: "apk", label: "Android APK" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveGuide(tab.id as any)}
                  className={cn(
                    "py-2 rounded-lg transition-all text-center cursor-pointer font-bold",
                    activeGuide === tab.id
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-4 min-h-[220px]">
              {activeGuide === "ios" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
                    👉 Open in Safari on your iPhone/iPad
                  </div>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Tap Safari's Share button</span>{" "}
                        <Share className="size-3.5 text-blue-600 inline mx-0.5 animate-pulse" /> at
                        the bottom or top of your browser.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">
                          Select "Add to Home Screen"
                        </span>{" "}
                        <PlusSquare className="size-3.5 text-blue-600 inline mx-0.5" /> from the
                        actions menu list.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Tap "Add"</span> in the
                        upper-right corner of the prompt screen to confirm.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "mac" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
                    👉 Requires Safari on macOS Sonoma or newer
                  </div>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">
                          Open "File" in macOS top menu bar
                        </span>{" "}
                        while browsing this website in Safari.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Click "Add to Dock..."</span>{" "}
                        from the dropdown file menu items.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Click "Add"</span> in the prompt
                        window. SN Gene HR will now be in your Dock!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "chrome" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Look at your address bar</span>{" "}
                        at the top of your desktop browser.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">
                          Click the Install icon
                        </span>{" "}
                        (it looks like a screen with a down arrow).
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Click "Install"</span> in the popup
                        to add the app to your computer.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "apk" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 rounded-xl text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest leading-relaxed">
                    👉 Install the native Android app
                  </div>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Download the APK</span> by clicking
                        the button below.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Open the downloaded file</span> and
                        allow installation from unknown sources if prompted.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <p className="text-muted-foreground font-medium">
                        <span className="font-bold text-foreground">Launch the app</span> directly from
                        your app drawer!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = "/app-release.apk";
                      link.download = "app-release.apk";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Download APK Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
