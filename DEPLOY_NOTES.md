# MediArk Static Site Upload Pack

This folder is the trimmed deployment package for the public website.

## Upload These

- All root `*.html` pages in this folder
- `en/`
- `works.json`
- `网页展示素材库/`
- `科普作品素材库/` only with the 20 files referenced by `works.json`

## Do Not Upload From The Original Project

- `mediark-app/`
- `.git/`
- `.vs/`
- `docs/`
- `backend_core.js`
- `scan_works.py`
- `works_template.csv`
- `负责人及团队情况展示/` (not referenced by the current public pages)
- Extra files under the original `科普作品素材库/` that are not referenced by `works.json`

## Current Package Size

- Total files: `91` including this note
- Website assets before trimming: original project had `27,248` files
- This upload pack is intended for static hosting such as Cloudflare Pages or GitHub Pages

## Suggested Hosting Root

- Use this folder itself as the publish root: `F:\github\mediark-site-upload`
