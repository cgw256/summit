[README.md](https://github.com/user-attachments/files/35432217/README.md)
# Summit – Peaks Fitness Coach (iPhone web app)

## 1. Put it on GitHub Pages (one time, ~5 min)
1. github.com → New repository → name it `summit` (Public is fine — no personal data is ever stored in the repo).
2. "Add file → Upload files" → drag in: index.html, app.js, sw.js, manifest.json, icon-512.png → Commit.
3. Settings → Pages → Source: "Deploy from a branch" → Branch: main / (root) → Save.
4. Your app URL: https://YOUR-USERNAME.github.io/summit/

## 2. Install on iPhone
Open the URL in Safari → Share → "Add to Home Screen". Always open it from that icon
(Home Screen apps keep their own storage, separate from Safari).

## 3. Connect Strava (one time)
1. On a computer: strava.com/settings/api → create an app.
   - Website: your app URL
   - Authorization Callback Domain: YOUR-USERNAME.github.io
2. In the app: Setup → paste Client ID + Client Secret → Save → Connect Strava → Authorize.
3. If iPhone lands you in Safari with an "Almost there" code screen: tap Copy code,
   open Summit from the Home Screen → Setup → Paste auth code.
After that it auto-syncs whenever you open the app (every 6+ hrs) or when you tap Sync.

## 4. Data
Everything is stored only on your phone. Use Setup → Backup monthly (save to iCloud Drive/Files).
Backups exclude your Strava keys.

## Updating the app later
Replace app.js / index.html in GitHub. Change `summit-v1` in sw.js to `summit-v2` so phones pick up the new version.
