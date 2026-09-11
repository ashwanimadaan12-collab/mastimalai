# Masti Malai — Android app

Native Android client (Kotlin + Jetpack Compose + Media3/ExoPlayer) on the **same backend**
as the web app. Login, home (hero + carousels + continue-watching), movie/series detail,
HLS playback with resume, search, my-list, subscription — all from the API.

## Requirements
- **Android Studio** (Ladybug / 2024.2+). It bundles the JDK, Android SDK and an emulator —
  you do **not** need to install Java/Gradle/SDK separately.
- The backend API running (`npm run dev:api` from the repo root, on `:4000`).

> This project was authored outside Android Studio, so the Gradle **wrapper JAR is not
> included**. Opening the project in Android Studio fixes this automatically on first sync
> (it uses `gradle/wrapper/gradle-wrapper.properties`). If you build from the CLI instead,
> run `gradle wrapper` once (needs a local Gradle) to generate `gradlew`.

## Run it
1. In Android Studio: **File → Open →** select `apps/android`. Let it sync + download deps.
2. Start the backend: `npm run dev:api` (and seed if you haven't: `npm run seed`).
3. Pick a device:
   - **Emulator** (recommended): the app talks to your Mac's backend at `http://10.0.2.2:4000`
     — already the default (`API_BASE_URL` in `app/build.gradle.kts`).
   - **Real phone** (USB): change `API_BASE_URL` to your Mac's LAN IP, e.g.
     `http://192.168.1.50:4000`, and make sure the phone is on the same Wi-Fi. (Cleartext HTTP
     to that IP is allowed via `res/xml/network_security_config.xml` for dev.)
4. Press **Run ▶**. Log in with any 10-digit number (e.g. `9876543210`); the dev OTP shows on
   screen and auto-fills.

## Why it works across hosts
Playback URLs from the API are **relative** (`/streaming/...`); the app joins them with its own
`API_BASE_URL`. So the exact same backend serves the browser (`localhost`), the emulator
(`10.0.2.2`), a real device (LAN IP) or a deployed domain — no server change needed.

## Structure (`app/src/main/java/com/mastimalai/ott`)
```
data/        Models (kotlinx.serialization), ApiService (Retrofit), Network (OkHttp +
             auth interceptor + token refresh), SessionManager (DataStore), Repository
di/          ServiceLocator (manual DI)
ui/theme/    Dark cinematic Compose theme
ui/components/ PosterCard, SectionRow, badges, loading
ui/screens/  Login, Home, Detail (movie), Series, Player (ExoPlayer), Search, MyList,
             Profile, Subscription
MainActivity Compose NavHost + bottom navigation
```

## What's included vs. next
- ✅ OTP auth + token refresh, home/detail/search/my-list, HLS player with resume + progress
  save, subscription (local sandbox), premium wall, deep-link scheme `masti://`.
- ▶️ Next: Google Play Billing (real subscriptions), kids profiles, downloads/offline,
  push (FCM), richer series UI, tablet/TV layouts.

## Google Play note
For Play Store distribution, digital subscriptions must use **Google Play Billing** (not the
web payment flow). The current subscription screen uses the dev sandbox; wire Play Billing +
server-side entitlement before release.
