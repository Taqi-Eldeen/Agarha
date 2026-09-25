# ADR-0011: Maps and geocoding provider

- Status: **Open** — mock geocoder and a free OSM-based basemap are wired in · Date: 2026-09
- Needs: owner decision (cost vs Arabic place-name quality).

## Options

| Provider             | Arabic POIs/addresses in Egypt | Cost at our scale                                              | Notes                                                   |
| -------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| Google Maps Platform | Best                           | Highest; $200/month credit historically, now per-SKU free caps | Android map SDK key needed anyway for react-native-maps |
| Mapbox               | Good, weaker Arabic POIs       | Lower                                                          | MapLibre-compatible styles on web                       |
| MapTiler / OSM       | Fair                           | Lowest                                                         | Good enough for a basemap; geocoding weaker             |

## Decision (default)

Provider-neutral code: `MapsProvider` port (`google | mapbox | mock`) for geocoding in the API,
`NEXT_PUBLIC_MAP_STYLE_URL` for the MapLibre basemap on web, Google Maps SDK on Android and Apple Maps
on iOS through react-native-maps. Recommended: Google for geocoding (dealer branch addresses) and a
MapLibre-compatible vector style for web tiles to cap cost.
