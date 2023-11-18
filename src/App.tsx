import React, { useCallback, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { useDropzone } from 'react-dropzone'
import { addGeojsonSourceAndLayers, addGSIPhotoImageLayer, emphasizeIsland, gpxFile2txt, processGeoJSON, setControl, synthesizeAttribution } from './lib';
// @ts-ignore
import tj from '@mapbox/togeojson'
import GeoJSON from 'geojson'
import { GeoloniaMap } from '@geolonia/embed-react'
// @ts-ignore
import type { Map } from '@geolonia/embed'

function App() {

  const [geojsons, setGeojsons] = useState<(GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null)[]>([])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const gpxTexts = await Promise.all(acceptedFiles.map(acceptedFile => gpxFile2txt(acceptedFile)))
    const gpxXMLs = gpxTexts.map(gpxText => new DOMParser().parseFromString(gpxText, 'text/xml'))
    const geojsons = gpxXMLs.map(gpxXml => tj.gpx(gpxXml) as GeoJSON.FeatureCollection<GeoJSON.LineString>)
    const enrichedGeoJSONs = geojsons.map(geojson => processGeoJSON(geojson))
    setGeojsons(enrichedGeoJSONs)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  const onLoadCallback = useCallback((map: Map) => {
    map.once('load', async () => {
      emphasizeIsland(map)
      addGeojsonSourceAndLayers(map, geojsons, () => {
        addGSIPhotoImageLayer(map)
        setControl(map, synthesizeAttribution)
      })
    })
  }, [geojsons])

  return (
    geojsons.length > 0 ?
      <div className="map-wrap">
        <GeoloniaMap
          className="map"
          onLoad={onLoadCallback}
          gestureHandling="off"
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
