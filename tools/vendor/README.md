# SheetJS Community Edition

- Version: 0.20.3 (mini standalone build)
- SHA-256: `0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939`
- Source: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js
- License: Apache-2.0; see `sheetjs-LICENSE.txt`.
- Official installation guidance: https://docs.sheetjs.com/docs/getting-started/installation/standalone/

Used only by the local member editor to read `.xlsx` files. The library is stored locally so importing does not contact a CDN or upload member data. The `tools/` directory is excluded from the site's deployment copy step.

# JSZip

- Version: 3.10.1
- SHA-256: `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`
- Source: https://github.com/Stuk/jszip/releases/tag/v3.10.1 (`dist/jszip.min.js`)
- License: MIT or GPLv3; used under MIT. See `jszip-LICENSE.md`.
- API documentation: https://stuk.github.io/jszip/documentation/api_jszip/load_async.html

Used only by the local member editor to extract images anchored in the avatar column of `.xlsx` files. Images are matched by worksheet relationships and cell coordinates; external image links are never fetched.
