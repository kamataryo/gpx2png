import React, { useCallback, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { useDropzone } from 'react-dropzone'
import { addGeojsonSourceAndLayers, addGSIPhotoImageLayer, gpxFile2txt, processGeoJSON, setControl, synthesizeAttribution } from './lib';
// @ts-ignore
import tj from '@mapbox/togeojson'
import GeoJSON from 'geojson'
import maplibregl from 'maplibre-gl';
import Map from 'react-map-gl/maplibre';

function App() {

  const [geojsons, setGeojsons] = useState<(GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> | null)[]>([])

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
    const joinedGeoJSONs = [...geojsons.filter(geojson => geojson.features.length > 0), ...gpxGeojsons]
    console.log(joinedGeoJSONs)
    // @ts-ignore
    const enrichedGeoJSONs = joinedGeoJSONs.map(geojson => processGeoJSON(geojson))
    setGeojsons(enrichedGeoJSONs)
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({ onDrop })

  const onLoadCallback = useCallback((e: maplibregl.MapLibreEvent) => {
    const map = e.target
    map.once('load', async () => {
      addGeojsonSourceAndLayers(map, geojsons, () => {
        addGSIPhotoImageLayer(map)
        setControl(map, synthesizeAttribution)
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
