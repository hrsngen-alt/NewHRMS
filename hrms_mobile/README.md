# SN Gene HRMS Mobile Application

Welcome to the native mobile application for **SN Gene HRMS**, built with **Flutter**.

This single-codebase app compiles to premium native mobile clients for **iOS** and **Android**. It integrates with your live Supabase cloud database and your high-performance **Redis Cloud caching Edge Functions** to ensure rapid data loading.

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Flutter SDK**: Install the Flutter SDK (>= 3.0.0). Refer to the [Flutter Installation Guide](https://docs.flutter.dev/get-started/install).
- **Xcode** (for iOS builds): Requires a Mac with Xcode installed.
- **Android Studio** (for Android builds): Setup the Android SDK and SDK tools.

### 2. Configure Environment URL
The Supabase URL and keys are pre-configured inside `lib/services/supabase_service.dart`. To update them in the future, modify the static configurations inside the service class.

### 3. Install Package Dependencies
Navigate to the mobile app folder and run:
```bash
flutter pub get
```

### 4. Run on Emulator / Simulator
- Start an Android emulator or iOS simulator.
- Launch the application:
```bash
flutter run
```

---

## 📱 Native Device Configurations

To support **GPS Geolocation tracking** for attendance logging, native platform permissions must be configured:

### Android Configuration
Open [android/app/src/main/AndroidManifest.xml](file:///Users/hardik/Downloads/NewHRMS/hrms_mobile/android/app/src/main/AndroidManifest.xml) and add these permissions inside the `<manifest>` tag:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS Configuration
Open [ios/Runner/Info.plist](file:///Users/hardik/Downloads/NewHRMS/hrms_mobile/ios/Runner/Info.plist) and add these keys inside the `<dict>` tag:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>SN Gene HR requires GPS access to capture your clock-in coordinates for shift attendance records.</string>
```

---

## 📦 Production Builds & Store Deployment

### 🤖 Android: Building for Google Play Store

#### 1. Generate a Signing Keystore
To sign your app, generate a secure Keystore file in your terminal:
```bash
keytool -genkey -v -keystore ~/key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias key
```

#### 2. Configure Release Signing
Create a `key.properties` file in `android/` and configure:
```properties
storePassword=your-keystore-password
keyPassword=your-key-password
keyAlias=key
storeFile=/Users/your-username/key.jks
```
Edit [android/app/build.gradle](file:///Users/hardik/Downloads/NewHRMS/hrms_mobile/android/app/build.gradle) to read `key.properties` and add standard `signingConfigs` details.

#### 3. Build Production App Bundle
Compile the optimized Android App Bundle (AAB):
```bash
flutter build appbundle --release
```
Your release file is saved at `build/app/outputs/bundle/release/app-release.aab`.

#### 4. Upload to Google Play Console
1. Go to [Google Play Console](https://play.google.com/console).
2. Create an App, set the category, and complete the App Dashboard tasks (privacy policy, target audience, etc.).
3. Under **Release** -> **Production**, click **Create New Release**.
4. Upload `app-release.aab`.
5. Roll out the release to your users!

---

### 🍏 iOS: Building for Apple App Store

#### 1. Configure Xcode Signing
1. Open the `/ios` folder in Xcode: `open ios/Runner.xcworkspace`.
2. In the left panel, click on **Runner**.
3. Under **Signing & Capabilities**, select **Automatically manage signing**.
4. Select your **Apple Developer Program Team**.
5. Change the **Bundle Identifier** to your registered reverse-domain bundle ID (e.g. `com.sngene.hrms`).

#### 2. Build the Production IPA Archive
Compile the iOS release package in your terminal:
```bash
flutter build ipa --release
```
Your build output is compiled to `build/ios/archive/Runner.xcarchive` and exported to `build/ios/ipa/`.

#### 3. Upload to App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com).
2. Create a new App profile and enter your Bundle ID.
3. Open Xcode -> **Window** -> **Organizer**.
4. Select your compiled `Runner` build under Archives, click **Distribute App**, and select **App Store Connect**.
5. Follow the prompts to upload your build.
6. Once the build completes processing in App Store Connect, map it to your Store version and submit it for App Review!
