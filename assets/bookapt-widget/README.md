# BookAPT Widget Package

This archive contains everything you need to embed the BookAPT booking widget on a website.

## Contents
- `bookapt-widget.js` – the production-ready embed script.
- `example.html` – minimal example showing how to host the widget locally.
- `README.md` – these installation notes.

## Quick Start
1. Upload `bookapt-widget.js` to a public folder in your site or serve it from your CDN. In production you can also replace the script path with the managed CDN version when available.
2. Add the following tag before your closing `</body>` element. Replace `YOUR_BUSINESS_ID` with the ID from the BookAPT dashboard.

```html
<script src="/path/to/bookapt-widget.js" data-business-id="YOUR_BUSINESS_ID"></script>
```

3. Reload your page. A floating calendar button will appear in the lower-right corner. Clicking it opens the BookAPT booking experience and sends customers to the BookAPT app or web portal to finish the flow.

## Local Testing
- Run the BookAPT web app on `http://localhost:3001` and the API on `http://localhost:3000` (default dev ports). The widget automatically detects the `localhost` hostname and points to those services.
- Open `example.html` in a browser and update the `data-business-id` attribute to verify the integration end-to-end.

## Production Notes
- Host the script over HTTPS to avoid browser warnings.
- Keep the script versioned. When a new widget build ships, swap the file or point to the official CDN URL provided by Oryn/BookAPT.
- The widget injects CSS with class names prefixed by `bookapt-` to avoid collisions, but you can override them in your own stylesheet if needed.

For additional implementation help, contact the Oryn team or review the consulting services resources.
