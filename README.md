# Piggy Bank — Four Category Replacement

This package adds four fixed, reusable category photos and OCR category detection. It does not use Gemini, an AI image API, or Supabase for images.

## Included
- `app.js` — updated app logic and OCR classification
- `index.html` — adds Drink and Addon to the manual category selector
- `style.css` — the existing stylesheet
- `assets/category-food.jpg`
- `assets/category-drink.jpg`
- `assets/category-addon.jpg`
- `assets/category-other.jpg`

## Before replacing anything
1. Download/keep a backup of your current GitHub repository files.
2. Export your Piggy Bank JSON backup if available. The app's finance records are stored in this browser's localStorage; replacing files should not intentionally clear them, but keep a backup.
3. Do not delete your old Supabase project or tables. This version simply no longer calls the Gemini food-image function.

## Install on GitHub Pages
1. Open your Piggy Bank repository on GitHub.
2. Upload/replace `app.js`, `index.html`, and `style.css` in the same folder where they currently live.
3. Create a folder named `assets` at that same level if it does not already exist. Upload all four JPGs into it, keeping the exact filenames.
4. Commit the changes. Wait for GitHub Pages to publish.
5. Open the website and hard-refresh with `Ctrl + F5`.
6. Test OCR import with examples: `鸡饭` → Food, `MILO AIS` → Drink, `加菜 x2` → Addon, `PENCIL` → Other. Review the category before importing.

## Important
- Existing transactions are not deleted or rewritten by this code. Their current saved categories remain as-is until you edit them. New OCR rows use the four-way classifier.
- Category detection uses keywords, not AI, so ambiguous descriptions can be misclassified. OCR review lets you change the category before importing.
- The category images are static local assets; no API key or extra recurring cost is needed.


## PWA / Install as an app
This version includes `manifest.json`, `sw.js`, and three Piggy Bank icons. Upload all files and folders to the same repository location as `index.html`, keeping paths intact. Commit and push to GitHub Pages, wait for deployment, then open the HTTPS website and install it from the browser menu (Chrome/Edge: install icon or menu → Install app; Android Chrome: menu → Add to Home screen; iPhone/iPad Safari: Share → Add to Home Screen).

The service worker caches the app shell and four category images for offline opening after the first successful online load. Google Fonts and the Tesseract OCR library are external resources and may not be available offline. Existing finance data remains in the browser's localStorage; this is not cloud sync and does not move data between devices. For updated service worker files, refresh the website online once after deployment.
