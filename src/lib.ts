import { ExportControl2, ExportOptions } from './mbgl-export-control2'
import { buildTraceSVG, Trace } from './svg'
import * as turf from '@turf/turf'

// ベースマップ定義。ダウンロード画像を SNS 等で使っても権利上問題ないものだけを載せる
export type BaseMapDef = { label: string; tiles: string; attribution: string; maxzoom: number }
export const BASE_MAPS: Record<string, BaseMapDef> = {
  seamlessphoto: {
    label: 'シームレス空中写真（日本）',
    tiles: 'https://maps.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    attribution: '国土地理院 シームレス空中写真',
    maxzoom: 18,
  },
  s2cloudless: {
    // 全世界カバーの航空写真（Copernicus Sentinel-2 由来のクラウドフリーモザイク, CC BY-NC-SA 4.0）
    label: '衛星写真（全世界 / Sentinel-2）',
    tiles: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
    attribution: 'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH',
    maxzoom: 14,
  },
}
export const DEFAULT_BASE_MAP = 'seamlessphoto'

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
      'line-width': 6,
      'line-color': 'rgb(255, 72, 0)',
    }
  })
  map.addLayer({
    id: 'track-end-halo2',
    type: 'circle',
    filter: ['all',
      ['==', '$type', 'Point'],
      ['==', 'end', 'true'],
    ],
    source: 'track',
    paint: {
      'circle-radius': 20,
      'circle-color': 'rgb(255, 72, 0)',
    },
  })
  map.addLayer({
    id: 'track-end',
    type: 'circle',
    filter: ['all',
      ['==', '$type', 'Point'],
      ['==', 'end', 'true'],
    ],
    source: 'track',
    paint: {
      'circle-radius': 14,
      'circle-color': 'darkblue',
    },
  })
  map.addLayer({
    id: 'track-end-label',
    type: 'symbol',
    source: 'track',
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-field': '{label}',
      'text-size': 32,
      'text-font': ["Noto Sans Regular"],
      'text-anchor': 'bottom-right',
      'text-offset': [-0.3, -0.4],
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

// ベースマップのラスタを差し替える。track レイヤの下に敷く（style.json の layers は空なので単純に差し込むだけ）
export const setBaseMap = (map: maplibregl.Map, key: string) => {
  const bm = BASE_MAPS[key] || BASE_MAPS[DEFAULT_BASE_MAP]
  if (map.getLayer('basemap')) map.removeLayer('basemap')
  if (map.getSource('basemap')) map.removeSource('basemap')
  map.addSource('basemap', {
    type: 'raster',
    tiles: [bm.tiles],
    tileSize: 256,
    maxzoom: bm.maxzoom,
    attribution: bm.attribution,
  })
  const before = map.getLayer('track') ? 'track' : undefined
  map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 22 }, before)
}

// 従来どおりの入口（デフォルト＝シームレス空中写真）
export const addGSIPhotoImageLayer = (map: maplibregl.Map) => setBaseMap(map, DEFAULT_BASE_MAP)

export const setControl = (map: maplibregl.Map, options: ExportOptions) => {
  map.addControl(new ExportControl2(options))
}

// 左上のベースマップ切替ドロップダウン（MapLibre カスタムコントロール）
export class BaseMapSelectControl {
  private container: HTMLDivElement | null = null
  constructor(private current: string, private onChange: (key: string) => void) {}
  onAdd() {
    const div = document.createElement('div')
    div.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    div.style.padding = '2px 4px'
    const select = document.createElement('select')
    select.style.border = 'none'
    select.style.background = 'transparent'
    select.style.fontSize = '14px'
    select.style.cursor = 'pointer'
    for (const [key, bm] of Object.entries(BASE_MAPS)) {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = bm.label
      if (key === this.current) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener('change', () => this.onChange(select.value))
    div.appendChild(select)
    this.container = div
    return div
  }
  onRemove() { this.container?.remove() }
}

const blobToDataURI = (blob: Blob) =>
  new Promise<string>(resolve => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(blob)
  })

// PNG ベース地図（ラスタのみ）＋GeoJSON トレースを合成した SVG Blob を生成する。
// 地物・テキストはベクタとして分離し加工できるよう、PNG からは track 系レイヤを外して撮り直す。
// 引数の map は書き出し用オフスクリーンマップで、この直後に破棄されるため可視状態の復元は不要。
export const generateSVG = async (
  map: maplibregl.Map,
  geojsons: any[],
  attribution: string,
  showEnd: boolean,
): Promise<Blob> => {
  const width = map.getContainer().offsetWidth
  const height = map.getContainer().offsetHeight

  for (const id of ['track', 'track-end-halo2', 'track-end', 'track-end-label']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
  }
  await new Promise<void>(resolve => map.once('idle', () => resolve()))
  const basemapBlob = await new Promise<Blob>((resolve, reject) =>
    map.getCanvas().toBlob(b => b ? resolve(b) : reject(new Error('cannot capture basemap'))))
  const imageHref = await blobToDataURI(basemapBlob)
  const traces: Trace[] = geojsons.map(gj => {
    const line = gj.features.find((f: any) => f.geometry.type === 'LineString')
    const endFeature = gj.features.find((f: any) => f.properties?.end === 'true')
    const points: [number, number][] = line
      ? line.geometry.coordinates.map((c: number[]) => { const p = map.project(c as [number, number]); return [p.x, p.y] })
      : []
    let end: Trace['end']
    if (endFeature) {
      const p = map.project(endFeature.geometry.coordinates)
      end = { x: p.x, y: p.y, label: endFeature.properties.label }
    }
    return { points, end }
  })
  const svg = buildTraceSVG(width, height, imageHref, traces, attribution, showEnd)
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

// ダウンロード画像の右下に帰属表示テキストを焼き込む（選択中ベースマップに応じて内容を切り替え）
export const drawAttributionText = async (target: Blob, text: string): Promise<Blob> => {
  const url = URL.createObjectURL(target)
  const img = new Image()
  img.src = url
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no ctx')
  ctx.drawImage(img, 0, 0)
  const fontSize = Math.max(12, Math.round(canvas.width * 0.014))
  const pad = fontSize * 0.6
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.lineJoin = 'round'
  ctx.lineWidth = fontSize * 0.25
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.strokeText(text, canvas.width - pad, canvas.height - pad)
  ctx.fillStyle = 'black'
  ctx.fillText(text, canvas.width - pad, canvas.height - pad)
  const result = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('cannot convert into Blob'))))
  URL.revokeObjectURL(url)
  return result
}

export const synthesizeAttribution = async (target: Blob): Promise<Blob> => {


  const attributionImageResp = await fetch('https://kamataryo.github.io/gpx2png/attribution.png')
  const targetImageUrl = URL.createObjectURL(target)
  const attrImageUrl = URL.createObjectURL(await attributionImageResp.blob())
  const targetImage = new Image()
  const attrImage = new Image()

  targetImage.src = targetImageUrl
  attrImage.src = attrImageUrl
  await Promise.all([
    new Promise((resolve, reject) => {
      targetImage.onload = () => resolve(true)
      targetImage.onerror = (e) => reject(e)
    }),
    new Promise((resolve, reject) => {
      attrImage.onload = () => resolve(true)
      attrImage.onerror = (e) => reject(e)
    })
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
  console.log(13)
  URL.revokeObjectURL(targetImageUrl)
  URL.revokeObjectURL(targetImageUrl)
  targetImage.remove()
  attrImage.remove()
  canvas.remove()

  return synthesized

}
