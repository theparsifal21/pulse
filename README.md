# PULSE — v0.6 Spotify integration

**Listen. Collect. Discover.**

PULSE is a free, standalone, local-first personal music player for mobile and desktop. It runs entirely in your browser and does not require NEXUS, an account, a backend, API keys or a build step.

[**Open PULSE**](https://theparsifal21.github.io/pulse/)

## Spotify integration (v0.6)

Open Spotify from Home, Liked Songs, or the navigation menu. Copy a track, album, playlist, show or episode link from Spotify and add it to PULSE. Give it an optional display name, then open the official embedded player or the Spotify app/site. Search opens Spotify's own search page. No API key or Premium subscription is required to save links. Playback availability and previews are controlled by Spotify; full playback is not guaranteed. Saved links are stored separately on this device, are not included in metadata backups, and require internet for playback. No account synchronization or audio downloads are provided.

The existing screenshot scanner and local audio library are retained.

## Features

- Import local audio files or folders (folder selection depends on browser support).
- Extract supported MP3 and FLAC metadata and embedded artwork.
- Browse tracks, albums, artists and playlists; search, sort and edit track metadata.
- Create and edit playlists, reorder tracks and save the playback queue as a playlist.
- Like songs, browse recently played tracks and view listening statistics.
- Play, pause, skip, seek, shuffle, repeat and manage the queue.
- Use the compact mobile mini-player or expand it into a full-screen Now Playing view with artwork and playback controls.
- Navigate with mobile bottom tabs, collection filters, quick-access tiles and touch-friendly menus.
- Install as a progressive web app (PWA) on supported browsers.
- Use the cached app shell and locally stored music offline after initial setup.
- Export and restore metadata backups.

## Mobile experience

The v0.5 interface prioritizes phone screens while preserving desktop support.

1. Open PULSE in your mobile browser.
2. Import music from your device.
3. Use Home, Library, Playlists and More in the bottom navigation.
4. Tap the track title or artwork in the mini-player to open Now Playing.
5. Collapse the player to continue browsing.

### Install on your phone

- **Android:** In Chrome, open the menu and select **Install app** or **Add to Home screen**, when available.
- **iPhone:** In Safari, open Share and select **Add to Home Screen**.

PULSE is a web app, not a native APK or App Store application. Background playback, file selection and installation behavior depend on your browser and operating system.

## Run locally

Clone the repository or download its ZIP and extract it. Open a terminal in the directory containing `index.html`:

```bash
python -m http.server 8000
```

Open http://localhost:8000 and keep the server running. HTTPS or localhost is required for full browser capabilities.

## Deploy with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, and select `main` and `/ (root)`. No build command is required.

## Project structure

All project files are in the repository root.

| File | Purpose |
| --- | --- |
| `index.html` | Application shell and player markup |
| `style.css` | Mobile-first responsive styling |
| `app.js` | Views, navigation, playback and local storage |
| `core.js` | Queue, sorting-related helpers and backup validation |
| `meta.js` | Audio metadata parsing |
| `manifest.json` | PWA configuration |
| `service-worker.js` | Offline app-shell caching |
| `logo.svg`, `icon-192.png`, `icon-512.png` | Branding and app icons |
| `test.js` | Automated logic tests |
| `CHANGELOG.md` | Release history |

## Storage and backups

Music files, artwork, playlists, track metadata and listening history are stored locally using IndexedDB. Playback preferences also use browser storage.

- No cloud synchronization is included. Spotify links use official online embeds, not native streaming.
- Backups contain metadata, playlists, history and volume settings, **not audio files or artwork**.
- Keep your original music files separately.
- Clearing site data, browser storage eviction or changing devices may remove access to your library.
- Browser storage is shared by pages on the same origin. Use a dedicated origin if you need isolation. The existing `pulse` database name is preserved for compatibility with earlier versions.
- Moving to a different origin does not automatically migrate your library.

## Testing

Run the existing automated logic tests with Node.js:

```bash
node test.js
```

The v0.5 JavaScript syntax was checked. Real-device mobile rendering and live deployment have not yet been fully verified. Audio codec support varies by browser.

## Latest release — v0.6

- Spotify link library with duplicate prevention, removal, official embeds and external search.
- Home and Liked Songs shortcuts; existing local player and screenshot scanner retained.
- Updated service worker cache and visible version in Settings.
- Browser playback and deployment have not yet been verified.

## Previous release — v0.5

- Mobile-first interface across the application.
- Compact mini-player and full-screen Now Playing.
- SVG navigation icons, collection tabs and home shortcuts.
- Responsive artwork grids, detail views and bottom-sheet menus.
- Updated offline cache.
- Existing desktop support and local database retained.
