declare module 'vue-flickity' {
  import { DefineComponent } from 'vue'
  
  interface FlickityOptions {
    prevNextButtons?: boolean
    pageDots?: boolean
    wrapAround?: boolean
    cellAlign?: string
    contain?: boolean
    draggable?: boolean
    freeScroll?: boolean
    groupCells?: boolean | number
    adaptiveHeight?: boolean
    percentPosition?: boolean
    resize?: boolean
    setGallerySize?: boolean
    watchCSS?: boolean
  }

  interface FlickityComponent extends DefineComponent {
    reloadCells: () => void
    select: (index: number) => void
  }

  const Flickity: DefineComponent<{
    options: FlickityOptions
  }, {}, any, {}, {}, {}, {}, {
    reloadCells: () => void
    select: (index: number) => void
  }>

  export default Flickity
} 