# PULSE changelog

## v0.6 — Spotify integration
- Save Spotify track, album, playlist, episode and show links locally.
- Official embedded player, external search and open-in-Spotify links.
- No credentials required; playback depends on Spotify and internet access.
- Preserve local library and screenshot scanner; update PWA cache.
- Browser testing pending.

## v0.2

## Bugs fixed (audit items)
1. **Empty playlist buttons** – Play/Shuffle are only rendered when the playlist has playable tracks; `playall` also guards empty groups.
2. **Deleting tracks vs queue** – `removeFromQueue()` (core.js) fixes queue, shuffle origin and index; deleting the playing track plays the next one (if it was playing) or stops cleanly.
3. **Deleted tracks resurrected** – history writes no longer re-put track records; play counts use `putIfExists` (checks the record exists inside the transaction). Likes/edits use it too.
4. **Playlist Shuffle** – now shuffles the whole playlist (`playList(..., force=true)`) and turns shuffle on.
5. **History not saved** – saved on track change, end of queue and repeat; pending session is written synchronously on `pagehide`/`visibilitychange` and recovered at next startup.
6. **Repeat-one** – each loop flushes its own session and starts a new one.
7. **Load race conditions** – `load()` uses a token; stale loads abort after every `await`; audio is paused before flushing so time isn't attributed to the wrong track.
8. **Service worker cache deletion** – only caches prefixed `pulse-static-` are removed.
9. **Stale files** – network-first with cache fallback; bump `V` in service-worker.js per release.
10. **Mobile playlists** – new Playlists page (with New playlist) in the mobile nav; nav scrolls horizontally.
11. **Orphaned files** – audio, cover and metadata are saved in one transaction (`saveTrack`); deletion of track+audio is one transaction.
12. **Import robustness** – 8 s duration timeout, per-file progress (`n/total: name`), per-file try/catch, failure summary dialog; undecodable files are rejected instead of stored.
13. **Duplicates** – SHA-256 file hash (exact duplicates) plus tag-based check for older tracks without a hash; always asks first.
14. **Tags & artwork** – new `meta.js` reads ID3v2.2/2.3/2.4 and FLAC (title, artist, album artist, album, track, disc, year, genre, cover). Covers are de-duplicated by hash in a `covers` store.
15. **Restore validation** – `validateQueue()` drops missing tracks, clamps index/position, sanitises repeat/shuffle.
16. **DB errors** – transactions reject on error/abort; user actions are wrapped and toast the error; global `unhandledrejection` handler.
17. **Overlapping renders** – render token; async data (history) is fetched first, views are synchronous.
18. **PWA icons** – 192/512 PNG icons, apple-touch-icon, manifest updated.
19. **Backup/restore** – JSON export (metadata, playlists, history, settings), validated import with confirmation, reports tracks lacking audio.
20. **Tests** – `node test.js` (15 tests).

## Features added
Metadata + artwork extraction; Albums/Artists index and detail pages; card-based home with featured item and shelves; Playlists page; playlist rename + description + ↑/↓ reordering; Play next / Add to queue (⋯ menu); Settings page (storage usage + persistence request, backup, history clearing, NEXUS URLs); NEXUS switcher; IndexedDB v1→v2 upgrade (existing stores untouched).

## Tests actually performed
- `node test.js`: parseName, queue removal (before/after/current/last/only/shuffle-origin), insertNext/addToQueue, move, shuffle permutation, validateQueue, validateBackup, ID3v2.3 parsing (latin-1 + UTF-16 text, APIC), garbage input, FLAC Vorbis+picture – all pass.
- `node --check` on every JS file – pass. PNG icons generated.
- **Not tested**: anything in a real browser (playback, IndexedDB upgrade, import UI, SW, mobile layout, Media Session). No real MP3/FLAC files were available.

## Not done / limitations
Full-screen Now Playing; custom playlist cover upload; provider system (Jamendo, Internet Archive, MusicBrainz) – deliberately not faked; M4A/OGG tags (filename fallback); disc headings on multi-disc albums; Hungarian UI; backups exclude audio and covers; cover object URLs are cached for the session; full modular split (app.js is still one file besides core/meta).

## v0.3 standalone
Removed cross-app navigation, URL configuration and legacy integration settings from backups. Preserved the v2 library schema and all music features. Restricted service worker fetch handling to its scope; updated cache version. Updated launch and deployment instructions.
