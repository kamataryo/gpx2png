// @ts-ignore
import type { Map } from '@geolonia/embed'
import ExportControl from '@geolonia/mbgl-export-control/src/index'

export const gpx2str = (gpxFile: File) => {
  const reader = new FileReader()
  return new Promise<string>(resolve => {
    reader.onload = (e) => {
      resolve(e.target?.result as string)
    }
    reader.readAsText(gpxFile)
  })
}

export const addGeojsonSourceAndLayers = (map: Map, geojson: any) => {
  map.addSource('track', {
    type: 'geojson',
    data: geojson,
  })
  map.addLayer({
    id: 'track',
    type: 'line',
    filter: ['==', '$type', 'LineString'],
    source: 'track',
    paint: {
      'line-width': 2,
      'line-color': 'red',
    }
  }, 'place-island-name')
  map.addLayer({
    id: 'track-end',
    type: 'circle',
    filter: ['==', '$type', 'Point'],
    source: 'track',
    paint: {
      'circle-radius': 5,
      'circle-color': 'red',
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
      'text-halo-color': 'white',
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
    }
  }, 'place-island-name')
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
