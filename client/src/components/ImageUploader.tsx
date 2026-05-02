import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type Konva from 'konva'
import { Arrow, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva'

type AnnotationTool = 'rectangle' | 'arrow' | 'text'
type AnnotationColor = 'red' | 'blue' | 'green'

type RectangleAnnotation = {
  id: string
  tool: 'rectangle'
  color: AnnotationColor
  x: number
  y: number
  width: number
  height: number
}

type ArrowAnnotation = {
  id: string
  tool: 'arrow'
  color: AnnotationColor
  x: number
  y: number
  endX: number
  endY: number
}

type TextAnnotation = {
  id: string
  tool: 'text'
  color: AnnotationColor
  x: number
  y: number
  text: string
}

type Annotation = RectangleAnnotation | ArrowAnnotation | TextAnnotation
type NewAnnotation =
  | Omit<RectangleAnnotation, 'id'>
  | Omit<ArrowAnnotation, 'id'>
  | Omit<TextAnnotation, 'id'>

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
  allowAnnotations?: boolean
  editorSurface?: boolean
  uploadMode?: 'bulk' | 'replace'
  onImagesUpload: (files: File[]) => void
  onImageReplace?: (file: File) => void
  onAnnotationsChange: (annotations: ImageAnnotations) => void
  onAnnotationCreate: (annotation: NewAnnotation) => void
  onSelectedToolChange: (tool: AnnotationTool) => void
  onSelectedColorChange: (color: AnnotationColor) => void
}

function ImageUploader({
  imageFile,
  annotations,
  selectedTool,
  selectedColor,
  allowUpload = true,
  allowAnnotations = true,
  editorSurface = false,
  uploadMode = 'bulk',
  onImagesUpload,
  onImageReplace,
  onAnnotationsChange,
  onAnnotationCreate,
  onSelectedToolChange,
  onSelectedColorChange,
}: ImageUploaderProps) {
  const [canvasImage, setCanvasImage] = useState<HTMLImageElement | null>(null)
  const [draftAnnotation, setDraftAnnotation] = useState<NewAnnotation | null>(null)
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
    if (!allowAnnotations || annotationMode !== 'draw') return

    const position = event.target.getStage()?.getPointerPosition()

    if (!position || !canvasImage) return

    if (selectedTool === 'text') {
      const text = window.prompt('Enter label text')?.trim()

      if (text) {
        onAnnotationCreate({
          tool: 'text',
          color: selectedColor,
          x: position.x,
          y: position.y,
          text,
        })
      }

      return
    }

    setStartPoint(position)
    setDraftAnnotation(
      selectedTool === 'arrow'
        ? {
            tool: 'arrow',
            color: selectedColor,
            x: position.x,
            y: position.y,
            endX: position.x,
            endY: position.y,
          }
        : {
            tool: 'rectangle',
            color: selectedColor,
            x: position.x,
            y: position.y,
            width: 0,
            height: 0,
          },
    )
  }

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const position = event.target.getStage()?.getPointerPosition()

    if (!allowAnnotations || annotationMode !== 'draw' || !position || !startPoint) return

    if (selectedTool === 'arrow') {
      setDraftAnnotation({
        tool: 'arrow',
        color: selectedColor,
        x: startPoint.x,
        y: startPoint.y,
        endX: position.x,
        endY: position.y,
      })
      return
    }

    if (selectedTool === 'rectangle') {
      setDraftAnnotation({
        tool: 'rectangle',
        color: selectedColor,
        x: Math.min(startPoint.x, position.x),
        y: Math.min(startPoint.y, position.y),
        width: Math.abs(position.x - startPoint.x),
        height: Math.abs(position.y - startPoint.y),
      })
    }
  }

  const handleMouseUp = () => {
    if (!allowAnnotations || annotationMode !== 'draw') return

    const isValidDraft =
      draftAnnotation?.tool === 'rectangle'
        ? draftAnnotation.width > 3 && draftAnnotation.height > 3
        : draftAnnotation?.tool === 'arrow'
          ? Math.hypot(draftAnnotation.endX - draftAnnotation.x, draftAnnotation.endY - draftAnnotation.y) > 3
          : false

    if (draftAnnotation && isValidDraft) {
      onAnnotationCreate(draftAnnotation)
    }

    setStartPoint(null)
    setDraftAnnotation(null)
  }

  const renderAnnotation = (annotation: Annotation | NewAnnotation, key?: number | string) => {
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

    if (annotation.tool === 'arrow') {
      return (
        <Arrow
          key={key}
          points={[annotation.x, annotation.y, annotation.endX, annotation.endY]}
          stroke={annotation.color}
          fill={annotation.color}
          strokeWidth={2}
          pointerLength={10}
          pointerWidth={10}
        />
      )
    }

    return (
      <Text
        key={key}
        x={annotation.x}
        y={annotation.y}
        text={annotation.text}
        fill={annotation.color}
        fontSize={16}
        fontStyle="bold"
        stroke="white"
        strokeWidth={0.5}
      />
    )
  }

  const content = (
    <>
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
          {allowAnnotations && (
            <>
              <div className="button-row annotation-toolbar">
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
              <div className="button-row annotation-toolbar">
                <button
                  type="button"
                  onClick={() => onSelectedToolChange('rectangle')}
                  disabled={selectedTool === 'rectangle'}
                >
                  Rectangle
                </button>
                <button
                  type="button"
                  onClick={() => onSelectedToolChange('arrow')}
                  disabled={selectedTool === 'arrow'}
                >
                  Arrow
                </button>
                <button
                  type="button"
                  onClick={() => onSelectedToolChange('text')}
                  disabled={selectedTool === 'text'}
                >
                  Text
                </button>
              </div>
              <div className="button-row annotation-toolbar">
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
            </>
          )}
          <div className={editorSurface ? 'image-canvas-surface' : undefined}>
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
        </div>
      )}
    </>
  )

  if (editorSurface) {
    return <div className="image-editor-surface">{content}</div>
  }

  return (
    <section className="card">
      <h2>Image Upload</h2>
      {content}
    </section>
  )
}

export default ImageUploader
