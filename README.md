# Epiweb

A web application for cataloguing and reading Chinese stone inscriptions and the material
around them: sites, objects, inscriptions, rubbings, persons, places and bibliography.

It runs at <https://epiwen.github.io/epiweb>.

Plain HTML, CSS and JavaScript. No framework, no build step, no server of its own. The
application reads and writes its data directly from GitHub.

## What it does

**Browse.** A map of the sites. A catalogue of objects, inscriptions and rubbings. Registers of
persons, institutions, places and dates. Bibliography, premodern sources, modern corpora and
glyph tables.

**Edit.** Forms for inscriptions, objects, sites, authority records and bibliography. Each one
produces TEI-EpiDoc and saves it back to GitHub.

**Compare.** A IIIF viewer (Mirador) for placing rubbings side by side, with saved sets.

**Reference.** The controlled vocabularies, the ontology, a project wiki, an issue list and a
change log.

## Where the data is

The application holds no data of its own.

| Repository | Visibility | Holds |
| --- | --- | --- |
| `epiwen/epiweb` | public | this application |
| `epiwen/epiwen-data-public` | public | the open corpus: inscriptions, rubbings, place authorities |
| `epiwen/epiwen-data` | private | curated authority records and bibliography |

Further collections can be added from other repositories. A reader without access to one does
not see it.

## Signing in

The map, the sites list and the catalogue are readable without signing in. Everything else, and
all editing, needs a GitHub account with access to the repository concerned.

Sign in on `login.html` with a personal access token. The token stays in the browser.

- Writing to the public corpus needs a classic token with `public_repo`.
- Editing the private data needs `repo`.

## Running it locally

```bash
python3 -m http.server 8137
```

Then open <http://localhost:8137/>. Nothing to install.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | landing page |
| `map.html`, `sites.html`, `catalog.html` | the pages open to everyone |
| `editor.html`, `object-editor.html`, `site-editor.html`, `authority-editor.html`, `biblio-editor.html` | the editors |
| `viewer.html`, `favorites.html` | IIIF comparison and saved sets |
| `auth.js`, `data.js`, `collections.js`, `github.js` | reading from and writing to GitHub |
| `generator.js` | builds the TEI; runs in the browser and in Node |
| `vocab.js` | controlled vocabularies and the reign-era table |
| `leaflet/` | map library, bundled |
| `oauth-worker/` | optional sign-in endpoint, not currently in use |
| `examples/` | sample records |

## Tests

```bash
node test/build-test.js | xmllint --noout -
```

No output means the generated XML is well formed.

## Credits

The editor form follows the Hamburg *Metadata Generator for EpiDoc*. The vocabularies come from
the Buddhist Stone Sutras project at the Heidelberg Academy of Sciences and Humanities.

## Licence

Not yet set.
