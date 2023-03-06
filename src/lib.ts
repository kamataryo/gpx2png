// @ts-ignore
import type { Map } from '@geolonia/embed'
import ExportControl from '@geolonia/mbgl-export-control/src/index'
import * as turf from '@turf/turf'

export const gpxFile2txt = (gpxFile: File) => {
  const reader = new FileReader()
  return new Promise<string>(resolve => {
    reader.onload = (e) => {
      resolve(e.target?.result as string)
    }
    reader.readAsText(gpxFile)
  })
}

export const processGeoJSON = (geojson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
  const { length: totalLength } = geojson.features[0].geometry.coordinates.reduce<{ cursor: null | number[], length: number }>((prev, current) => {
    if(prev.cursor === null) {

    } else {
      prev.length += turf.distance(prev.cursor, current, { units: 'kilometers' })
    }
    prev.cursor = current
    return prev
  } , { length: 0, cursor: null })

  const startPoint = geojson.features[0].geometry.coordinates[0]
  const endPoint = geojson.features[0].geometry.coordinates[geojson.features[0].geometry.coordinates.length - 1]

  let midPointIndex: number | null = null
  let indexCursor = 0
  let midLength = 0
  while (midPointIndex === null) {
    const prev = geojson.features[0].geometry.coordinates[indexCursor]
    const next = geojson.features[0].geometry.coordinates[indexCursor + 1]
    midLength += turf.distance(prev, next, { units: 'kilometers' })
    if(midLength > totalLength / 2) {
      midPointIndex = indexCursor
    } else {
      indexCursor ++
    }
  }
  const midPoint = geojson.features[0].geometry.coordinates[midPointIndex]

  const enrichedGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: [
      geojson.features[0],
    ]
  }
  enrichedGeoJSON.features = [
    geojson.features[0],
    { type: 'Feature', properties: { end: 'true', label: '0km' }, geometry: { type: 'Point', coordinates: startPoint } },
    { type: 'Feature', properties: { end: 'false', label: (Math.round(midLength * 100) / 100) + 'km' }, geometry: { type: 'Point', coordinates: midPoint } },
    { type: 'Feature', properties: { end: 'true', label: (Math.round(totalLength * 100) / 100) + 'km' }, geometry: { type: 'Point', coordinates: endPoint } },
  ]
  console.log(enrichedGeoJSON)
  return enrichedGeoJSON
}

export const addGeojsonSourceAndLayers = (map: Map, geojson: any) => {
  const bbox = turf.bbox(geojson) as any
  map.fitBounds(bbox, { padding: 50 })
  map.addSource('track', {
    type: 'geojson',
    data: geojson,
  })
  // map.addLayer({
  //   id: 'track-end-halo1',
  //   type: 'circle',
  //   filter: ['all',
  //     ['==', '$type', 'Point'],
  //     ['==', 'end','true'],
  //   ],
  //   source: 'track',
  //   paint: {
  //     'circle-radius': 9,
  //     'circle-color': 'black',
  //   },
  // }, 'place-island-name')
  // map.addLayer({
  //   id: 'track-halo',
  //   type: 'line',
  //   filter: ['==', '$type', 'LineString'],
  //   source: 'track',
  //   paint: {
  //     'line-width': 4,
  //     'line-color': 'black',
  //   }
  // }, 'place-island-name')
  map.addLayer({
    id: 'track',
    type: 'line',
    filter: ['==', '$type', 'LineString'],
    source: 'track',
    paint: {
      'line-width': 3,
      'line-color': 'orangered',
    }
  }, 'place-island-name')
  map.addLayer({
    id: 'track-end-halo2',
    type: 'circle',
    filter: ['all',
      ['==', '$type', 'Point'],
      ['==', 'end', 'true'],
    ],
    source: 'track',
    paint: {
      'circle-radius': 8,
      'circle-color': 'orangered',
    },
  }, 'place-island-name')
  // map.addLayer({
  //   id: 'track-end-halo3',
  //   type: 'circle',
  //   filter: ['all',
  //     ['==', '$type', 'Point'],
  //     ['==', 'end', 'true'],
  //   ],
  //   source: 'track',
  //   paint: {
  //     'circle-radius': 6,
  //     'circle-color': 'black',
  //   },
  // }, 'place-island-name')
  map.addLayer({
    id: 'track-end',
    type: 'circle',
    filter: ['all',
      ['==', '$type', 'Point'],
      ['==', 'end', 'true'],
    ],
    source: 'track',
    paint: {
      'circle-radius': 5,
      'circle-color': 'darkblue',
    },
  }, 'place-island-name')
  map.addLayer({
    id: 'track-end-label',
    type: 'symbol',
    source: 'track',
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-field': '{label}',
      'text-font': ["Noto Sans Regular"],
      'text-anchor': 'top',
      'text-offset': [0, 0.3],
    },
    paint: {
      'text-color': 'white',
      'text-halo-color': 'black',
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
    }
  }, 'place-island-name')
  console.log(map.getStyle())
}

export const addGSIPhotoImageLayer = (map: Map) => {
  map.addSource('gsi-photo', {
    type: 'raster',
    tiles: ['https://maps.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
    tileSize: 256,
    attribution: '国土地理院 全国最新写真',
  })
  map.addLayer({
    'id': 'gsi-photo',
    'type': 'raster',
    'source': 'gsi-photo',
    'minzoom': 0,
    'maxzoom': 22,
    }, 'oc-waterway-river-ja')
}

export const emphasizeIsland = (map: Map) => {
  map.setLayoutProperty('place-island-name', 'text-size', 14)
  map.setPaintProperty('place-island-name', 'text-color', 'black')
}

export const setControl = (map: Map) => {
  const control = new ExportControl({ attribution: '' })
  map.addControl(control)
}