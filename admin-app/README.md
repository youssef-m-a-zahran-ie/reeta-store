# Reeta Admin (Android app)

A thin Android shell (Capacitor) that opens https://admin.reeta-eg.com/admin. It holds no site code, so **every site update reaches the app
the moment it deploys**; nobody reinstalls anything. A new APK is only needed to change the app itself (icon, name, push notifications).

## Build the APK

Needs JDK 21 and the Android SDK. Signing key and its passwords live **outside the repo** in `%USERPROFILE%\reeta-keys\`
(`reeta-admin.jks`, `keystore.properties`). **Back that folder up: without the key, installed apps can never be updated in place.**

```
cd admin-app/android
set JAVA_HOME=<jdk-21 folder>
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
gradlew.bat assembleRelease
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`. Raise `versionCode` in `android/app/build.gradle` for each new APK.

## After changing capacitor.config.json or resources/

```
npm install
npx cap sync android
npx capacitor-assets generate --android    # icons + splash from resources/
```
