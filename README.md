# Summit – Peaks Fitness Coach (iPhone web app)

## Install / update on GitHub Pages
1. github.com → your `summit` repo (or New repository → `summit`).
2. Add file → Upload files → drag in ALL of: index.html, app.js, coach.js, sw.js, manifest.json, icon-512.png → Commit.
3. First time only: Settings → Pages → Deploy from branch → main / (root).
4. On iPhone: open https://YOUR-USERNAME.github.io/summit/ in Safari → Share → Add to Home Screen.
   If updating, close and reopen the app twice to pick up the new version.

## Connect Strava (one time)
strava.com/settings/api → create app → Authorization Callback Domain: YOUR-USERNAME.github.io
In app: Setup → Client ID + Secret → Save → Connect Strava.
If you land in Safari with an "Almost there" code: copy it → open Summit from Home Screen → Setup → Paste auth code.

## Data
Stored only on your phone. Setup → Backup monthly to iCloud Drive/Files (Strava keys are never included).
