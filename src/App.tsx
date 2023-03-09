import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom'
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
      emphasizeIsland(map)
      addGeojsonSourceAndLayers(map, geojson, () => {
        addGSIPhotoImageLayer(map)
        setControl(map, synthesizeAttribution)
        const dlButton = document.querySelector('.mapboxgl-ctrl-icon[aria-label="Download"]')
        if(dlButton) {
        // TODO:
        //   const wizard = document.createElement('span')
        //   dlButton.append(wizard)
        //   wizard.className = 'wizard'
        //   wizard.textContent = 'クリックしてダウンロード'
        }
      })
    })
  }, [geojson])



  return (
    geojson ?
      <div className="map-wrap">
        <GeoloniaMap
          className="map"
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
