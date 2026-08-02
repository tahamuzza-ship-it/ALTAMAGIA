---
name: Browser auto-translate crashes React
description: Root cause of the user's unreproducible white-screen / removeChild crashes on his devices
---
The user's Chrome auto-translates pages, which mutates DOM text nodes and makes React throw `NotFoundError: removeChild` (white screen / error panel). This is why crashes appeared only on his computer/phone and never in the testing browser.

**Why:** Google Translate wraps/replaces text nodes; React's reconciliation then fails on removeChild.
**How to apply:** Every web artifact for this user must ship `<html lang="es" translate="no">` + `<meta name="google" content="notranslate">`. If he reports a crash that tests can't reproduce, suspect translation first.
