import { ExportControl2 } from './mbgl-export-control2'
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

export const processGeoJSON = (geojson: GeoJSON.FeatureCollection<GeoJSON.LineString, null | { coordTimes?: string[] }>) => {
  const mainTrack = geojson.features[0]
  const coordTimesAvailable = mainTrack.properties && Array.isArray(mainTrack.properties.coordTimes) && mainTrack.properties.coordTimes.every(value => typeof value === 'string') && mainTrack.properties.coordTimes.length === mainTrack.geometry.coordinates.length
  const { length: totalLength, speedList } = mainTrack.geometry.coordinates.reduce<{ cursor: null | number[], speedList: null | number[], length: number }>((prev, current, i) => {
    if(prev.cursor === null) {
      if(coordTimesAvailable) {
        prev.speedList = []
      }
    } else {
      const distance = turf.distance(prev.cursor, current, { units: 'kilometers' })
      if(coordTimesAvailable) {
        const interval = new Date(mainTrack.properties!.coordTimes![i]).getTime() - new Date(mainTrack.properties!.coordTimes![i - 1]).getTime()
        prev.speedList!.push(distance / (interval / 1000 / 60 / 60))
      }
      prev.length += distance
    }
    prev.cursor = current
    return prev
  } , { length: 0, speedList: null, cursor: null })

  let normalizedSpeedList: null | (number | null)[] = null
  if(speedList) {
    const speedMean = speedList.reduce((prev, current) => prev + current, 0) / speedList.length
    const speedStandardVariable = (speedList.reduce((prev, current) => {
      const diff = current - speedMean
      return prev + diff * diff
    }, 0) / speedList.length) ** 0.5

    normalizedSpeedList = speedList.map(speed => {
      const diff = Math.abs(speed - speedMean)
      if (diff > speedStandardVariable * 3) {
        return null
      } else {
        return speed
      }
    })
  }

  const enrichedMainTrack = {
    ...mainTrack,
    properties: {
      ...mainTrack.properties,
      speedList: normalizedSpeedList,
    }
  }

  const endPoint = mainTrack.geometry.coordinates[mainTrack.geometry.coordinates.length - 1]

  const enrichedGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: [
      enrichedMainTrack,
      { type: 'Feature', properties: { end: 'true', label: (Math.round(totalLength * 100) / 100) + 'km' }, geometry: { type: 'Point', coordinates: endPoint } },
    ]
  }

  return enrichedGeoJSON
}

export const addGeojsonSourceAndLayers = (map: maplibregl.Map, geojsons: any[], callback: Function) => {
  const geojson = { type: 'FeatureCollection' as const, features: geojsons.map(geojson => geojson.features).flat() }
  const bbox = turf.bbox(geojson) as any
  map.fitBounds(bbox, { padding: 50 })
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
      'line-width': 3,
      'line-color': 'rgb(255, 72, 0)',
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
      'circle-radius': 10,
      'circle-color': 'rgb(255, 72, 0)',
    },
  }, 'place-island-name')
  map.addLayer({
    id: 'track-end',
    type: 'circle',
    filter: ['all',
      ['==', '$type', 'Point'],
      ['==', 'end', 'true'],
    ],
    source: 'track',
    paint: {
      'circle-radius': 7,
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
      'text-size': 16,
      'text-font': ["Noto Sans Regular"],
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
    },
    paint: {
      'text-color': 'white',
      'text-halo-color': 'darkblue',
      'text-halo-width': 3,
      'text-halo-blur': 0.7,
    }
  })
  map.once('moveend', () => callback())
}

export const addGSIPhotoImageLayer = (map: maplibregl.Map) => {

  let layers = map.getStyle().layers
  const afterOf = layers[0].id

  const afterOfIndex = layers.map(layer => layer.id).indexOf(afterOf)

  for (let index = 0; index < afterOfIndex; index++) {
    map.removeLayer(layers[index].id)
  }
  layers = map.getStyle().layers
  for (const layer of layers) {
    if('source' in layer && (
      layer.source === 'fudepoli' ||
      (layer.source === 'geolonia' && layer['source-layer'] === 'landuse') ||
      layer.type === 'fill' ||
      layer.id === 'waterway-river'
      )) {
      map.removeLayer(layer.id)
    }
  }

  const layerId = 'gsi-photo'

  map.addSource('gsi-photo', {
    type: 'raster',
    tiles: ['https://maps.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
    tileSize: 256,
    attribution: '国土地理院 シームレス空中写真',
  })
  map.addLayer({
    'id': layerId,
    'type': 'raster',
    'source': 'gsi-photo',
    'minzoom': 0,
    'maxzoom': 22,
    }, afterOf)
}

export const emphasizeIsland = (map: maplibregl.Map) => {
  map.setLayoutProperty('place-island-name', 'text-size', 16)
  map.setPaintProperty('place-island-name', 'text-color', 'black')

  const layers = map.getStyle().layers
  for (const layer of layers) {
    // @ts-ignore
    if(layer.source === 'geolonia' && layer.layout && layer.layout['text-field']) {
      map.setPaintProperty(layer.id, 'text-color', 'black')
    }
  }
}

export const setControl = (map: maplibregl.Map, callback: (image: Blob) => Promise<Blob>) => {
  const control = new ExportControl2({ callback })
  map.addControl(control)
}

export const synthesizeAttribution = async (target: Blob): Promise<Blob> => {


  const attributionImageResp = await fetch('./attribution.png')

  const targetImageUrl = URL.createObjectURL(target)
  const attrImageUrl = URL.createObjectURL(await attributionImageResp.blob())

  const targetImage = new Image()
  targetImage.src = targetImageUrl
  const attrImage = new Image()
  attrImage.src = attrImageUrl

  await Promise.all([
    new Promise(resolve => { targetImage.onload = () => resolve(true) }),
    new Promise(resolve => { attrImage.onload = () => resolve(true) })
  ])

  const canvas = document.createElement('canvas')
  canvas.width = targetImage.width
  canvas.height = targetImage.height
  document.body.append(canvas)
  const ctx = canvas.getContext('2d')
  if(!ctx) {
    throw new Error('no ctx')
  }
  ctx.drawImage(targetImage, 0, 0, targetImage.width, targetImage.height)
  ctx.drawImage(attrImage, 0, 0, targetImage.width, targetImage.height)

  const synthesized = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
    if(blob) {
      resolve(blob)
    } else {
      reject(new Error('cannot convert into Blob'))
    }
  }))

  URL.revokeObjectURL(targetImageUrl)
  URL.revokeObjectURL(targetImageUrl)
  targetImage.remove()
  attrImage.remove()
  canvas.remove()

  return synthesized

}
