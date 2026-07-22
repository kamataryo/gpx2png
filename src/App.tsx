import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { useDropzone } from 'react-dropzone'
import { addGeojsonSourceAndLayers, addGSIPhotoImageLayer, BaseMapSelectControl, BASE_MAPS, DEFAULT_BASE_MAP, drawAttributionText, generateSVG, gpxFile2txt, processGeoJSON, setBaseMap, setControl, synthesizeAttribution } from './lib';
// @ts-ignore
import tj from '@mapbox/togeojson'
import GeoJSON from 'geojson'
import maplibregl from 'maplibre-gl';
import Map from 'react-map-gl/maplibre';
// @ts-ignore
import FitParser from 'fit-file-parser'

const fitParser = new FitParser({
    force: true,
    speedUnit: 'km/h',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'list',
})

const parseFit = async (content: ArrayBuffer) => {
  return new Promise((resolve, reject) => {
    fitParser.parse(content, (error: any, data: any) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}


function App() {

  const [geojsons, setGeojsons] = useState<(GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null)[]>([])
  const [showEndMarker, setShowEndMarker] = useState(true)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)

  // ?features=next で解禁される機能フラグ（地図選択 + SVG ダウンロード）
  const featuresNext = useMemo(() => new URLSearchParams(window.location.search).get('features') === 'next', [])
  const baseMapRef = useRef(DEFAULT_BASE_MAP)
  const showEndMarkerRef = useRef(showEndMarker)
  useEffect(() => { showEndMarkerRef.current = showEndMarker }, [showEndMarker])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {

    const acceptedGeoJSONFiles = acceptedFiles.filter(acceptedFile => acceptedFile.name.match(/\.geojson$/))
    const acceptedGPXFiles = acceptedFiles.filter(acceptedFile => acceptedFile.name.match(/\.gpx$/))

    const geojsons = (await Promise.all(acceptedGeoJSONFiles.map(acceptedGeoJSON => acceptedGeoJSON.text())))
      .map(geojsonText => JSON.parse(geojsonText) as GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Point>)

    for (let index = 0; index < geojsons.length; index++) {
      const geojson = geojsons[index];
      const linestring = geojson.features.find(feature => feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')
      if(linestring) {
        geojson.features = [linestring]
      } else {
        geojson.features = []
      }
    }

    const gpxTexts = await Promise.all(acceptedGPXFiles.map(acceptedGPX => gpxFile2txt(acceptedGPX)))
    const gpxXMLs = gpxTexts.map(gpxText => new DOMParser().parseFromString(gpxText, 'text/xml'))
    const gpxGeojsons = gpxXMLs.map(gpxXml => tj.gpx(gpxXml) as GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString, null | { coordTimes?: string[] }>)

    for (const geojson of gpxGeojsons) {
      for (const feature of geojson.features) {
        if(feature.geometry.type === 'MultiLineString') {
          feature.geometry = {
            type: 'LineString',
            coordinates: feature.geometry.coordinates.flat()
          }
        }
      }
    }

    const fitGeojsons: (GeoJSON.FeatureCollection<GeoJSON.LineString>)[] = []
    const fitFiles = acceptedFiles.filter(acceptedFile => acceptedFile.name.match(/\.fit$/))
    for (const fitFile of fitFiles) {
      const arrayBuffer = await fitFile.arrayBuffer()
      const fitData = (await parseFit(arrayBuffer)) as { records: any[] }
      const records = fitData.records.filter(r => r.position_lat && r.position_long)
      const fitGeojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              timestamps: records.map(r => r.timestamp.toISOString()),
            },
            geometry: {
              type: 'LineString',
              coordinates: records.map(r => [r.position_long, r.position_lat]),
            },
          }
        ],
      }
      fitGeojsons.push(fitGeojson as GeoJSON.FeatureCollection<GeoJSON.LineString>)
    }
    console.log(fitGeojsons)


    const joinedGeoJSONs = [
      ...geojsons.filter(geojson => geojson.features.length > 0),
      ...gpxGeojsons,
      ...fitGeojsons,
    ]
    console.log(joinedGeoJSONs)
    // @ts-ignore
    const enrichedGeoJSONs = joinedGeoJSONs.map(geojson => processGeoJSON(geojson))

    const stats = enrichedGeoJSONs.map((geojson, i) => {
      const endFeature = geojson?.features.find((f: any) => f.properties?.end === 'true')
      const distanceKm = endFeature ? parseFloat((endFeature.properties as any).label) : 0
      return { index: i + 1, distanceKm: Math.round(distanceKm * 100) / 100 }
    })
    const totalDistanceKm = Math.round(stats.reduce((sum, s) => sum + s.distanceKm, 0) * 100) / 100
    console.log('GPX 統計:', { ファイル数: stats.length, 各ルート: stats, 合計距離: totalDistanceKm + 'km' })

    setGeojsons(enrichedGeoJSONs)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  useEffect(() => {
    if (!mapInstance) return
    const visibility = showEndMarker ? 'visible' : 'none'
    for (const layerId of ['track-end-halo2', 'track-end', 'track-end-label']) {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, 'visibility', visibility)
      }
    }
  }, [mapInstance, showEndMarker])

  const onLoadCallback = useCallback((e: maplibregl.MapLibreEvent) => {
    const map = e.target
    setMapInstance(map)
    map.once('load', async () => {
      addGeojsonSourceAndLayers(map, geojsons, () => {
        addGSIPhotoImageLayer(map)
        if (featuresNext) {
          map.addControl(
            new BaseMapSelectControl(baseMapRef.current, (key) => {
              baseMapRef.current = key
              setBaseMap(map, key)
            }),
            'top-left',
          )
          setControl(map, {
            dpi: 300,
            callback: (blob: Blob) => drawAttributionText(blob, BASE_MAPS[baseMapRef.current].attribution),
            svg: (m) => generateSVG(m, geojsons, BASE_MAPS[baseMapRef.current].attribution, showEndMarkerRef.current),
          })
        } else {
          setControl(map, { dpi: 300, callback: synthesizeAttribution })
        }
      })
    })
  }, [geojsons, featuresNext])

  return (
    (geojsons.length > 0) ?
      <div className="map-wrap">
        <div style={{
          position: 'absolute',
          top: 10,
          // features=next 時は左上にベースマップ切替ドロップダウンが入るので右に寄せる
          ...(featuresNext ? { right: 60 } : { left: 10 }),
          zIndex: 1000,
          background: 'white',
          padding: '8px 12px',
          borderRadius: 4,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          fontSize: 14,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showEndMarker}
              onChange={e => setShowEndMarker(e.target.checked)}
            />
            距離・終点マルを表示
          </label>
        </div>
        <Map
          style={{
            width: 'calc(100% - 50px)',
            height: 'calc(100% - 50px)',
            maxWidth: 'calc(100vh - 50px)',
            maxHeight: 'calc(100vw - 50px)',
          }}
          mapStyle={"./style.json"}
          onLoad={onLoadCallback}
        />
      </div>
     :
    <div className="App">
      <header className="App-header">
        <h1>{'GPS データ 画像変換'}</h1>
        <div className={(isDragActive ? 'drag-active ' : '') + "drop-target"} {...getRootProps()}>
          <img src={logo} className="App-logo" alt="logo" />
          <input {...getInputProps()} />
            <p>GPX ファイルをここにドラッグ<br />またはクリックしてアップロード</p>
        </div>
      </header>
    </div>
  );
}

export default App;
