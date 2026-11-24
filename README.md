# PULSE — Standalone v0.3
A free, local-first personal music player. No account, backend, API key, external application or build step required.

## Run on Windows
Extract the ZIP, open a terminal in the extracted folder (the one containing index.html), and run `python -m http.server 8000`. Open http://localhost:8000. Keep the terminal open while using the app. Alternatively deploy to GitHub Pages using the repository root. HTTPS or localhost is required for full browser capabilities.

## Features
Import audio files or folders, extract MP3/FLAC tags and artwork, browse albums/artists, search and sort, edit metadata, create playlists, like tracks, manage playback queue, shuffle/repeat, view listening history, and install as a PWA from a supported browser. Offline shell and audio stored locally in IndexedDB.

## Storage and backups
Use a dedicated hostname/origin for isolated browser storage. Different paths on the same origin share browser storage. The existing pulse database name is preserved for compatibility with prior PULSE installs on the same origin. Backups contain metadata, playlists, history and volume only, not audio or covers. Keep original music files separately. Browser storage may be evicted. A different origin does not automatically migrate your library.

## Tests
Run `node test.js`. Browser codec support varies; online streaming providers are not included.
