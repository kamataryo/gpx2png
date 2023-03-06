import React, { useCallback, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { useDropzone } from 'react-dropzone'
import { addGeojsonSourceAndLayers, addGSIPhotoImageLayer, emphasizeIsland, gpx2str, setControl } from './lib';
// @ts-ignore
import tj from '@mapbox/togeojson'
import GeoJSON from 'geojson'
import * as turf from '@turf/turf'
import { GeoloniaMap } from '@geolonia/embed-react'
// @ts-ignore
import type { Map } from '@geolonia/embed'

function App() {

  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const gpxText = await gpx2str(acceptedFiles[0])
    const gpxXml = new DOMParser().parseFromString(gpxText, 'text/xml')
    const geojson = tj.gpx(gpxXml) as GeoJSON.FeatureCollection<GeoJSON.LineString>

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
    const enrichedGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: [
        geojson.features[0],
      ]
    }
    enrichedGeoJSON.features = [
      geojson.features[0],
      { type: 'Feature', properties: { label: '0km' }, geometry: { type: 'Point', coordinates: startPoint } },
      { type: 'Feature', properties: { label: (Math.round(totalLength * 100) / 100) + 'km' }, geometry: { type: 'Point', coordinates: endPoint } },
    ]
    setGeojson(enrichedGeoJSON)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  const onLoadCallback = useCallback((map: Map) => {
    map.once('load', () => {
      addGSIPhotoImageLayer(map)
      addGeojsonSourceAndLayers(map, geojson)
      emphasizeIsland(map)
      setControl(map)
    })
  }, [geojson])

  return (
    geojson ?
    <>
      <script id="geojson" type="application/json">{JSON.stringify(geojson)}</script>
        <GeoloniaMap
          hash={'on'}
          style={ {width: '100%', height: '100%'} }
          onLoad={onLoadCallback}
        />
    </>
     :
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          {
            isDragActive ?
              <p>Drop the files here ...</p> :
              <p>Drag 'n' drop some files here, or click to select files</p>
          }
        </div>
      </header>
    </div>
  );
}

export default App;
