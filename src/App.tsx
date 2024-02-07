import React, { useCallback, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { useDropzone } from 'react-dropzone'
import { addGeojsonSourceAndLayers, addGSIPhotoImageLayer, emphasizeIsland, gpxFile2txt, processGeoJSON, setControl, synthesizeAttribution } from './lib';
// @ts-ignore
import tj from '@mapbox/togeojson'
import GeoJSON from 'geojson'
import maplibregl from 'maplibre-gl';
import Map from 'react-map-gl/maplibre';

function App() {

  const [geojsons, setGeojsons] = useState<(GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null)[]>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const gpxTexts = await Promise.all(acceptedFiles.map(acceptedFile => gpxFile2txt(acceptedFile)))
    const gpxXMLs = gpxTexts.map(gpxText => new DOMParser().parseFromString(gpxText, 'text/xml'))
    const geojsons = gpxXMLs.map(gpxXml => tj.gpx(gpxXml) as GeoJSON.FeatureCollection<GeoJSON.LineString, null | { coordTimes?: string[] }>)
    const enrichedGeoJSONs = geojsons.map(geojson => processGeoJSON(geojson))
    setGeojsons(enrichedGeoJSONs)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  const onLoadCallback = useCallback((e: maplibregl.MapLibreEvent) => {
    const map = e.target
    map.once('load', async () => {
      emphasizeIsland(map)
      addGeojsonSourceAndLayers(map, geojsons, () => {
        addGSIPhotoImageLayer(map)
        setControl(map, synthesizeAttribution)
        setTimeout(() => {
          console.log(map.getStyle().layers.map(l => l.id))
        }, 3000)
      })
    })
  }, [geojsons])

  return (
    (geojsons.length > 0) ?
      <div className="map-wrap">
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
