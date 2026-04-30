import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type Konva from 'konva'
import { Ellipse, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'

type AnnotationTool = 'rectangle' | 'circle'
type AnnotationColor = 'red' | 'blue' | 'green'

type Annotation = {
  tool: AnnotationTool
  color: AnnotationColor
  x: number
  y: number
  width: number
  height: number
}

type ImageAnnotations = {
  width: number
  height: number
  items: Annotation[]
}

type ImageUploaderProps = {
  imageFile: File | null
  annotations: ImageAnnotations
  selectedTool: AnnotationTool
  selectedColor: AnnotationColor
  allowUpload?: boolean
  uploadMode?: 'bulk' | 'replace'
  onImagesUpload: (files: File[]) => void
  onImageReplace?: (file: File) => void
  onAnnotationsChange: (annotations: ImageAnnotations) => void
  onSelectedToolChange: (tool: AnnotationTool) => void
  onSelectedColorChange: (color: AnnotationColor) => void
}

function ImageUploader({
  imageFile,
  annotations,
  selectedTool,
  selectedColor,
  allowUpload = true,
  uploadMode = 'bulk',
  onImagesUpload,
  onImageReplace,
  onAnnotationsChange,
  onSelectedToolChange,
  onSelectedColorChange,
}: ImageUploaderProps) {
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null)
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [annotationMode, setAnnotationMode] = useState<'view' | 'draw'>('view')

  useEffect(() => {
    if (!imageFile) return

    const imageUrl = URL.createObjectURL(imageFile)
    const image = new Image()

    image.onload = () => {
      const maxWidth = 500
      const scale = Math.min(maxWidth / image.width, 1)
      const width = image.width * scale
      const height = image.height * scale

      image.width = width
      image.height = height
      setCanvasImage(image)

      if (annotations.width === 0 || annotations.height === 0) {
        onAnnotationsChange({ ...annotations, width, height })
      }
    }

    image.src = imageUrl

    return () => URL.revokeObjectURL(imageUrl)
  }, [annotations, imageFile, onAnnotationsChange])

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length > 0) {
      setAnnotationMode('view')
      if (uploadMode === 'replace') {
        onImageReplace?.(files[0])
      } else {
        onImagesUpload(files)
      }
      event.target.value = ''
    }
  }

  const switchToViewMode = () => {
    setAnnotationMode('view')
    setStartPoint(null)
    setDraftAnnotation(null)
  }

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (annotationMode !== 'draw') return

    const position = event.target.getStage()?.getPointerPosition()

    if (!position || !canvasImage) return

    setStartPoint(position)
    setDraftAnnotation({
      tool: selectedTool,
      color: selectedColor,
      x: position.x,
      y: position.y,
      width: 0,
      height: 0,
    })
  }

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const position = event.target.getStage()?.getPointerPosition()

    if (annotationMode !== 'draw' || !position || !startPoint) return

    setDraftAnnotation({
      tool: selectedTool,
      color: selectedColor,
      x: Math.min(startPoint.x, position.x),
      y: Math.min(startPoint.y, position.y),
      width: Math.abs(position.x - startPoint.x),
      height: Math.abs(position.y - startPoint.y),
    })
  }

  const handleMouseUp = () => {
    if (annotationMode !== 'draw') return

    if (draftAnnotation && draftAnnotation.width > 3 && draftAnnotation.height > 3) {
      onAnnotationsChange({
        ...annotations,
        items: [...annotations.items, draftAnnotation],
      })
    }

    setStartPoint(null)
    setDraftAnnotation(null)
  }

  const renderAnnotation = (annotation: Annotation, key?: number | string) => {
    if (annotation.tool === 'rectangle') {
      return (
        <Rect
          key={key}
          x={annotation.x}
          y={annotation.y}
          width={annotation.width}
          height={annotation.height}
          stroke={annotation.color}
          strokeWidth={2}
        />
      )
    }

    return (
      <Ellipse
        key={key}
        x={annotation.x + annotation.width / 2}
        y={annotation.y + annotation.height / 2}
        radiusX={annotation.width / 2}
        radiusY={annotation.height / 2}
        stroke={annotation.color}
        strokeWidth={2}
      />
    )
  }

  return (
    <section className="card">
      <h2>Image Upload</h2>
      {allowUpload && (
        <input
          type="file"
          accept="image/*"
          multiple={uploadMode === 'bulk'}
          onChange={handleImageUpload}
        />
      )}
      {canvasImage && (
        <div className="annotation-panel">
          <h3>Preview:</h3>
          <div className="button-row">
            <button type="button" onClick={switchToViewMode} disabled={annotationMode === 'view'}>
              View
            </button>
            <button
              type="button"
              onClick={() => setAnnotationMode('draw')}
              disabled={annotationMode === 'draw'}
            >
              Draw
            </button>
          </div>
          <div className="button-row">
            <button
              type="button"
              onClick={() => onSelectedToolChange('rectangle')}
              disabled={selectedTool === 'rectangle'}
            >
              Rectangle
            </button>
            <button
              type="button"
              onClick={() => onSelectedToolChange('circle')}
              disabled={selectedTool === 'circle'}
            >
              Circle
            </button>
          </div>
          <div className="button-row">
            {(['red', 'blue', 'green'] as AnnotationColor[]).map((color) => (
              <button
                key={color}
                type="button"
                className="color-button"
                onClick={() => onSelectedColorChange(color)}
                disabled={selectedColor === color}
              >
                {color}
              </button>
            ))}
          </div>
          <Stage
            width={annotations.width}
            height={annotations.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ border: '1px solid #d7dbe2', display: 'inline-block' }}
          >
            <Layer>
              <KonvaImage image={canvasImage} width={annotations.width} height={annotations.height} />
              {annotations.items.map((annotation, index) => renderAnnotation(annotation, index))}
              {draftAnnotation && renderAnnotation(draftAnnotation, 'draft')}
            </Layer>
          </Stage>
        </div>
      )}
    </section>
  )
}

export default ImageUploader
