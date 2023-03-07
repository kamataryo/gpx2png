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

  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const gpxText = await gpxFile2txt(acceptedFiles[0])
    const gpxXml = new DOMParser().parseFromString(gpxText, 'text/xml')
    const geojson = tj.gpx(gpxXml) as GeoJSON.FeatureCollection<GeoJSON.LineString>
    const enrichedGeoJSON = processGeoJSON(geojson)
    setGeojson(enrichedGeoJSON)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  const onLoadCallback = useCallback((map: Map) => {
    map.once('load', async () => {
      addGSIPhotoImageLayer(map)
      addGeojsonSourceAndLayers(map, geojson)
      emphasizeIsland(map)
      setControl(map, synthesizeAttribution)
    })
  }, [geojson])

  return (
    geojson ?
        <GeoloniaMap
          className="map"
          hash={'on'}
          onLoad={onLoadCallback}
        />
     :
    <div className="App">
      <header className="App-header">
        <h1>GPX to PNG</h1>
        <img src={logo} className="App-logo" alt="logo" />
        <div className="drop-target" {...getRootProps()}>
          <input {...getInputProps()} />
          {
            isDragActive ?
              <p>GPX ファイルをドロップしてください</p> :
              <p>GPX ファイルをここにドラッグ<br />またはクリックして選択します</p>
          }
        </div>
      </header>
    </div>
  );
}

export default App;
