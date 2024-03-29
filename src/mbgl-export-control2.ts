import 'canvas-toBlob'
import FileSaver from 'file-saver'
import { loading, download } from '@geolonia/mbgl-export-control/src/icons'
import maplibregl from 'maplibre-gl'

type Options = {
  dpi: number,
  callback: (blob: Blob) => Promise<Blob>,
}

export class ExportControl2 {

  static defaultOptions: Options = {
    dpi: 300,
    callback: async (blob) => blob,
  }

  public options: Options
  public container: HTMLDivElement | null = null

  constructor(options: Partial<Options> = {}) {
    this.options = { ...ExportControl2.defaultOptions, ...options }
  }

  onAdd(map: maplibregl.Map) {
    this.container = document.createElement('div')
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group maplibregl-ctrl maplibregl-ctrl-group'

    const btn = document.createElement('button')
    btn.className = 'mapboxgl-ctrl-icon mapbox-gl-download maplibregl-ctrl-icon maplibre-gl-download'
    btn.type = "button"
    btn.setAttribute("aria-label", "Download")
    btn.innerHTML = download

    this.container.appendChild(btn)

    btn.addEventListener('click', async () => {
      const actualPixelRatio = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => this.options.dpi / 96
      });

      const _loading = this.loading()

      const _container = document.createElement('div')
      _container.className = 'tmp-container'
      document.body.appendChild(_container)

      const width = map.getContainer().offsetWidth
      const height = map.getContainer().offsetHeight

      this.setStyles(_container, {
        visibility: "hidden",
        position: "absolute",
        top: '-9999px',
        bottom: '-9999px',
        width: `${width}px`,
        height: `${height}px`,
      })

      let fontFamily = 'Noto Sans Regular'
      if (map.style.glyphManager && map.style.glyphManager.localIdeographFontFamily) {
        fontFamily = map.style.glyphManager.localIdeographFontFamily
      }

      const copiedStyle = JSON.parse(JSON.stringify(map.getStyle()))

      const _map = new maplibregl.Map({
        container: _container,
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        style: copiedStyle,
        localIdeographFontFamily: fontFamily,
        hash: false,
        preserveDrawingBuffer: true,
        interactive: false,
        attributionControl: false,
      })

      _map.once('load', () => {
        setTimeout(() => {          console.log(2)
          _map.getCanvas().toBlob(async (blob) => {
            if(blob) {
              console.log(4, this.options.callback)
              const transformed = await this.options.callback(blob)
              console.log(5)
              FileSaver.saveAs(transformed, `${_map.getCenter().toArray().join('-')}.png`)
            }
            _map.remove()
            _container.parentNode!.removeChild(_container)
            _loading.parentNode!.removeChild(_loading)
            Object.defineProperty(window, 'devicePixelRatio', {
              get: () => actualPixelRatio
            });
        })
        }, 3000)
      })


    })

    return this.container;
  }

  onRemove() {
    if(this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }

  loading() {
    const container = document.createElement('div')
    document.body.appendChild(container)

    this.setStyles(container, {
      position: "absolute",
      top: '0',
      bottom: '0',
      width: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      zIndex: '9999',
    })

    const icon = document.createElement('div')
    icon.innerHTML = loading

    this.setStyles(icon, {
      position: "absolute",
      top: '0',
      bottom: '0',
      left: '0',
      right: '0',
      zIndex: '9999',
      margin: "auto",
      width: "120px",
      height: "120px",
    })

    container.appendChild(icon)

    return container;
  }

  setStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    for (const style in styles) {
      // @ts-ignore
      element.style[style] = styles[style]
    }
  }
}
