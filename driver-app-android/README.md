# TTRIMS Driver — Native Android APK

A standalone native Android app (pure Java + XML) for logistics drivers.  
**Completely separate** from the main IMS frontend. No Capacitor, no Cordova, no web wrappers.

---

## 📁 Project Structure

```
driver-app-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/ttrims/driver/
│   │   │   ├── SplashActivity.java         ← Entry point, validates JWT
│   │   │   ├── LoginActivity.java          ← Login screen (long-press for custom URL)
│   │   │   ├── MainActivity.java           ← Bottom nav host (5 tabs)
│   │   │   ├── fragments/
│   │   │   │   ├── HomeFragment.java       ← Dashboard + duty status + GPS report
│   │   │   │   ├── ShipmentsFragment.java  ← Assigned trips + start trip
│   │   │   │   ├── PodConfirmFragment.java ← Proof of Delivery (signature + photo)
│   │   │   │   ├── HistoryFragment.java    ← Completed deliveries
│   │   │   │   ├── AttendanceFragment.java ← Clock in/out + live GPS pings
│   │   │   │   └── ProfileFragment.java    ← Driver account + sign out
│   │   │   ├── adapters/
│   │   │   │   ├── ShipmentAdapter.java    ← Shipment list + collapsible stops
│   │   │   │   └── HistoryAdapter.java     ← Completed shipment list
│   │   │   ├── api/
│   │   │   │   ├── ApiClient.java          ← Retrofit singleton
│   │   │   │   ├── ApiService.java         ← Retrofit interface (all endpoints)
│   │   │   │   └── AuthInterceptor.java    ← JWT Bearer token injector
│   │   │   ├── models/
│   │   │   │   ├── ApiResponse.java
│   │   │   │   ├── User.java
│   │   │   │   ├── Shipment.java
│   │   │   │   ├── ShipmentStop.java
│   │   │   │   └── AttendanceSession.java
│   │   │   ├── utils/
│   │   │   │   └── SessionManager.java     ← SharedPrefs JWT + user store
│   │   │   └── views/
│   │   │       └── SignatureView.java       ← Canvas signature pad (custom View)
│   │   ├── res/
│   │   │   ├── layout/ (14 XML layouts)
│   │   │   ├── values/ (colors, strings, themes, dimens)
│   │   │   ├── drawable/ (gradients, buttons, badges)
│   │   │   └── menu/bottom_nav_menu.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
├── settings.gradle
└── gradle.properties
```

---

## 🔧 Prerequisites

| Tool | Minimum Version |
|---|---|
| Android Studio | Hedgehog (2023.1.1) or newer |
| JDK | 17 |
| Android SDK | API 34 (compileSdk) |
| Build Tools | 34.0.0 |
| Gradle | 8.x (via wrapper) |

---

## 🚀 Build Steps

### 1. Open in Android Studio
```
File → Open → driver-app-android/
```

### 2. Sync Gradle
Android Studio will auto-sync. If it doesn't:
```
Tools → Sync Project with Gradle Files
```

### 3. Add App Icons (required to build)
Android Studio will show missing `mipmap/ic_launcher` errors.  
Go to:
```
app/src/main/res → right-click → New → Image Asset
```
Use a **truck icon** (🚚). Set foreground layer and generate all density variants.

### 4. Add Gradle Wrapper (if missing)
```bash
cd driver-app-android
gradle wrapper --gradle-version 8.7
```

### 5. Build Debug APK
```bash
# From driver-app-android/ root:
./gradlew assembleDebug
```
APK will be at:
```
app/build/outputs/apk/debug/app-debug.apk
```

### 6. Install on Device
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

Or drag the APK to an Android emulator.

---

## ⚙️ Configuration

### Backend API URL
Default: `https://ttrims-backend-4xho-4xho.onrender.com/api/`

To change at runtime (without rebuilding):
- **Long-press** the login card on the Login screen
- A "Custom Server URL" input appears
- Enter your backend URL and it will be saved persistently

To change at build time, edit:
```java
// ApiClient.java
public static final String DEFAULT_BASE_URL = "https://your-backend.com/api/";
```

---

## 📱 Features

| Feature | Description |
|---|---|
| **Login** | JWT authentication, persistent session (never auto-logout) |
| **Home** | Driver profile, duty status selector (Available/On Trip/Offline/Breakdown), active shipment summary |
| **Shipments** | Assigned trips, collapsible stop list, Start Trip (EN_ROUTE), Google Maps navigation per stop |
| **POD** | Proof of Delivery: signature pad, camera photo, receiver name/phone, failure reasons |
| **History** | Completed deliveries (DELIVERED/FAILED) |
| **Attendance** | GPS clock in/out, live elapsed timer, automatic 30-second GPS breadcrumbs |
| **Profile** | Driver account details, sign out |

---

## 🛡️ Session Behavior

This is a **permanent session** APK — matching the behavior of the main IMS APK:
- Token is stored in `SharedPreferences` and **never** auto-cleared on network errors
- Only explicit logout clears the session
- On app start, the saved token is validated silently; any network failure keeps the user logged in

---

## 🎨 Design System

Matches the TTRIMS web app dark theme:

| Token | Value |
|---|---|
| Background | `#090d16` |
| Surface | `#0f1422` |
| Card | `#171d2b` |
| Primary | `#2563eb` |
| Accent | `#06b6d4` |
| Success | `#10b981` |
| Danger | `#ef4444` |
| Warning | `#f59e0b` |

---

## 🔑 Required Permissions

- `INTERNET` — API calls
- `ACCESS_FINE_LOCATION` — GPS tracking for attendance and location reporting
- `CAMERA` — POD photo capture
- `VIBRATE` — Haptic feedback
