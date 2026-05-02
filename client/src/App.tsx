import { useState } from 'react'
import jsPDF from 'jspdf'
import FindingForm from './components/FindingForm'
import ImageUploader from './components/ImageUploader'
import type { SelectedPage } from './components/PageNavigator'
import PdfGenerator from './components/PdfGenerator'
import ReportDetailsForm from './components/ReportDetailsForm'
import SummaryEditor from './components/SummaryEditor'

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
type NewAnnotation = Omit<RectangleAnnotation, 'id'> | Omit<ArrowAnnotation, 'id'> | Omit<TextAnnotation, 'id'>

type ImageAnnotations = {
  width: number
  height: number
  items: Annotation[]
}

type InspectionImage = {
  id: string
  file: File
  annotations: ImageAnnotations
}

type CustomField = {
  key: string
  value: string
}

type Finding = {
  id: string
  imageId: string
  annotationId: string | null
  issueType: string
  severity: string
  description: string
  recommendation: string
  customFields: CustomField[]
}

type ImageData = {
  dataUrl: string
  width: number
  height: number
}

type ReportDetails = {
  projectName: string
  clientName: string
  inspectionType: string
  inspectionDate: string
  preparedBy: string
  companyName: string
  reportReference: string
}

type FindingRenderData = {
  finding: Finding
  image: InspectionImage
  annotation: Annotation | null
}

const emptyReportDetails: ReportDetails = {
  projectName: '',
  clientName: '',
  inspectionType: '',
  inspectionDate: '',
  preparedBy: '',
  companyName: '',
  reportReference: '',
}

const annotationColors: Record<AnnotationColor, [number, number, number]> = {
  red: [239, 68, 68],
  blue: [37, 99, 235],
  green: [22, 163, 74],
}

let nextId = 0

const createId = (prefix: string) => `${prefix}-${nextId++}`

const createEmptyAnnotations = (): ImageAnnotations => ({
  width: 0,
  height: 0,
  items: [],
})

const createBlankFinding = (imageId: string, annotationId: string | null = null): Finding => ({
  id: createId('finding'),
  imageId,
  annotationId,
  issueType: '',
  severity: '1',
  description: '',
  recommendation: '',
  customFields: [],
})

const copyFinding = (finding: Finding): Finding => ({
  ...finding,
  customFields: [...finding.customFields],
})

const findingsMatch = (first: Finding | null, second: Finding | null) => {
  if (!first || !second) return first === second

  return (
    first.id === second.id &&
    first.imageId === second.imageId &&
    first.annotationId === second.annotationId &&
    first.issueType === second.issueType &&
    first.severity === second.severity &&
    first.description === second.description &&
    first.recommendation === second.recommendation &&
    first.customFields.length === second.customFields.length &&
    first.customFields.every(
      (field, index) =>
        field.key === second.customFields[index]?.key &&
        field.value === second.customFields[index]?.value,
    )
  )
}

const readImageData = (file: File) =>
  new Promise<ImageData>((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      const dataUrl = reader.result as string
      const image = new Image()

      image.onload = () => {
        resolve({
          dataUrl,
          width: image.width,
          height: image.height,
        })
      }

      image.src = dataUrl
    }

    reader.readAsDataURL(file)
  })

const getSelectedIndex = (selectedPage: SelectedPage, prefix: 'finding' | 'image') => {
  if (!selectedPage.startsWith(`${prefix}-`)) return null

  return Number(selectedPage.replace(`${prefix}-`, ''))
}

const getAnnotationBounds = (annotation: Annotation) => {
  if (annotation.tool === 'rectangle') {
    return {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    }
  }

  if (annotation.tool === 'arrow') {
    return {
      x: Math.min(annotation.x, annotation.endX),
      y: Math.min(annotation.y, annotation.endY),
      width: Math.abs(annotation.endX - annotation.x),
      height: Math.abs(annotation.endY - annotation.y),
    }
  }

  return {
    x: annotation.x,
    y: annotation.y,
    width: 120,
    height: 24,
  }
}

function App() {
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const [selectedPage, setSelectedPage] = useState<SelectedPage>('cover')
  const [reportPreviewPage, setReportPreviewPage] = useState(0)
  const [reportDetails, setReportDetails] = useState<ReportDetails>(emptyReportDetails)
  const [summaryText, setSummaryText] = useState('')
  const [images, setImages] = useState<InspectionImage[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null)
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('rectangle')
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>('red')

  const selectedFindingIndex = getSelectedIndex(selectedPage, 'finding')
  const selectedImageIndex = getSelectedIndex(selectedPage, 'image')
  const selectedFinding =
    selectedFindingIndex === null ? null : findings[selectedFindingIndex] ?? null
  const selectedImage = selectedImageIndex === null ? null : images[selectedImageIndex] ?? null

  const severityCounts = findings.reduce<Record<string, number>>(
    (counts, finding) => ({
      ...counts,
      [finding.severity]: counts[finding.severity] + 1,
    }),
    { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  )
  const highestSeverity =
    findings.length > 0 ? Math.max(...findings.map((finding) => Number(finding.severity))) : null
  const reportPagesCount = 2 + images.length
  const safeReportPreviewPage = Math.min(reportPreviewPage, reportPagesCount - 1)
  const hasUnsavedFindingChanges = !findingsMatch(selectedFinding, editingFinding)

  const getFindingRenderData = (finding: Finding): FindingRenderData | null => {
    const image = images.find((currentImage) => currentImage.id === finding.imageId)
    const annotation =
      finding.annotationId === null
        ? null
        : image?.annotations.items.find((item) => item.id === finding.annotationId) ?? null

    if (!image) return null

    return { finding, image, annotation }
  }

  const updateImageAnnotations = (imageIndex: number, annotations: ImageAnnotations) => {
    setImages((currentImages) =>
      currentImages.map((image, index) =>
        index === imageIndex ? { ...image, annotations } : image,
      ),
    )
  }

  const replaceImage = (imageIndex: number, file: File) => {
    const image = images[imageIndex]
    if (!image) return

    setImages((currentImages) =>
      currentImages.map((currentImage, index) =>
        index === imageIndex
          ? { ...currentImage, file, annotations: createEmptyAnnotations() }
          : currentImage,
      ),
    )
    setFindings((currentFindings) =>
      currentFindings.filter((finding) => finding.imageId !== image.id),
    )
    setEditingFinding(null)
    setReportPreviewPage((currentPage) =>
      Math.min(currentPage, findings.filter((finding) => finding.imageId !== image.id).length + 1),
    )
  }

  const addImages = (files: File[]) => {
    if (files.length === 0) return

    const firstNewImageIndex = images.length
    setImages((currentImages) => [
      ...currentImages,
      ...files.map((file) => ({
        id: createId('image'),
        file,
        annotations: createEmptyAnnotations(),
      })),
    ])
    setEditingFinding(null)
    setSelectedPage(`image-${firstNewImageIndex}`)
  }

  const createFindingForImage = (imageIndex: number) => {
    const image = images[imageIndex]
    if (!image) return

    const finding = createBlankFinding(image.id)
    const newFindingIndex = findings.length

    setFindings((currentFindings) => [...currentFindings, finding])
    setEditingFinding(copyFinding(finding))
    setSelectedPage(`finding-${newFindingIndex}`)
  }

  const attachAnnotationToFinding = (findingIndex: number, annotation: NewAnnotation) => {
    const finding = findings[findingIndex]
    if (!finding) return

    const imageIndex = images.findIndex((image) => image.id === finding.imageId)
    if (imageIndex === -1) return

    const annotationWithId = { ...annotation, id: createId('annotation') } as Annotation
    const previousAnnotationId = finding.annotationId

    setImages((currentImages) =>
      currentImages.map((currentImage, index) =>
        index === imageIndex
          ? {
              ...currentImage,
              annotations: {
                ...currentImage.annotations,
                items: [
                  ...currentImage.annotations.items.filter(
                    (item) => item.id !== previousAnnotationId,
                  ),
                  annotationWithId,
                ],
              },
            }
          : currentImage,
      ),
    )
    setFindings((currentFindings) =>
      currentFindings.map((currentFinding, index) =>
        index === findingIndex
          ? { ...currentFinding, annotationId: annotationWithId.id }
          : currentFinding,
      ),
    )
    setEditingFinding((currentEditingFinding) =>
      currentEditingFinding && selectedFindingIndex === findingIndex
        ? { ...currentEditingFinding, annotationId: annotationWithId.id }
        : currentEditingFinding,
    )
  }

  const openNewFindingPage = () => {
    if (selectedImageIndex !== null && selectedImage) {
      createFindingForImage(selectedImageIndex)
      return
    }

    setEditingFinding(null)
    setSelectedPage('new-finding')
  }

  const updateEditingFinding = (updates: Partial<Finding>) => {
    if (!editingFinding) return

    setEditingFinding({ ...editingFinding, ...updates })
  }

  const selectPage = (page: SelectedPage) => {
    setSelectedPage(page)

    const findingIndex = getSelectedIndex(page, 'finding')
    if (findingIndex === null) {
      setEditingFinding(null)
      return
    }

    const finding = findings[findingIndex]
    setEditingFinding(finding ? copyFinding(finding) : null)
  }

  const saveFindingChanges = () => {
    if (selectedFindingIndex === null || !editingFinding) return false

    setFindings((currentFindings) =>
      currentFindings.map((finding, index) =>
        index === selectedFindingIndex ? editingFinding : finding,
      ),
    )
    return true
  }

  const switchToPreviewMode = () => {
    if (hasUnsavedFindingChanges) {
      saveFindingChanges()
    }

    setEditorMode('preview')
  }

  const deleteFinding = () => {
    if (selectedFindingIndex === null) return

    deleteFindingAtIndex(selectedFindingIndex)
  }

  const editFindingAtIndex = (findingIndex: number) => {
    const finding = findings[findingIndex]
    if (!finding) return

    setEditingFinding(copyFinding(finding))
    setSelectedPage(`finding-${findingIndex}`)
  }

  const deleteFindingAtIndex = (findingIndex: number) => {
    const finding = findings[findingIndex]
    if (!finding) return

    const confirmed = window.confirm('Delete this finding?')
    if (!confirmed) return

    const remainingFindings = findings.filter((_, index) => index !== findingIndex)
    setFindings(remainingFindings)
    setImages((currentImages) =>
      currentImages.map((image) =>
        image.id === finding.imageId
          ? {
              ...image,
              annotations: {
                ...image.annotations,
                items:
                  finding.annotationId === null
                    ? image.annotations.items
                    : image.annotations.items.filter((annotation) => annotation.id !== finding.annotationId),
              },
            }
          : image,
      ),
    )
    setEditingFinding(null)
    setReportPreviewPage((currentPage) => Math.min(currentPage, remainingFindings.length + 1))

    if (selectedFindingIndex !== null && selectedFindingIndex === findingIndex) {
      if (findingIndex < remainingFindings.length) {
        setEditingFinding(copyFinding(remainingFindings[findingIndex]))
        setSelectedPage(`finding-${findingIndex}`)
        return
      }

      setSelectedPage('summary')
    }
  }

  const drawPdfAnnotation = (
    doc: jsPDF,
    annotation: Annotation,
    imageX: number,
    imageY: number,
    annotationScaleX: number,
    annotationScaleY: number,
  ) => {
    const [red, green, blue] = annotationColors[annotation.color]

    doc.setDrawColor(red, green, blue)
    if (annotation.tool === 'rectangle') {
      doc.rect(
        imageX + annotation.x * annotationScaleX,
        imageY + annotation.y * annotationScaleY,
        annotation.width * annotationScaleX,
        annotation.height * annotationScaleY,
      )
      return
    }

    if (annotation.tool === 'arrow') {
      const startX = imageX + annotation.x * annotationScaleX
      const startY = imageY + annotation.y * annotationScaleY
      const endX = imageX + annotation.endX * annotationScaleX
      const endY = imageY + annotation.endY * annotationScaleY
      const angle = Math.atan2(endY - startY, endX - startX)
      const arrowHeadLength = 4.5

      doc.line(startX, startY, endX, endY)
      doc.line(
        endX,
        endY,
        endX - arrowHeadLength * Math.cos(angle - Math.PI / 7),
        endY - arrowHeadLength * Math.sin(angle - Math.PI / 7),
      )
      doc.line(
        endX,
        endY,
        endX - arrowHeadLength * Math.cos(angle + Math.PI / 7),
        endY - arrowHeadLength * Math.sin(angle + Math.PI / 7),
      )
      return
    }

    doc.setTextColor(red, green, blue)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(
      annotation.text,
      imageX + annotation.x * annotationScaleX,
      imageY + annotation.y * annotationScaleY,
    )
    doc.setTextColor(0, 0, 0)
  }

  const generatePDF = async () => {
    if (findings.length === 0) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    const maxImageHeight = 120
    const coverRows = [
      ['Project Name', reportDetails.projectName],
      ['Client Name', reportDetails.clientName],
      ['Inspection Type', reportDetails.inspectionType],
      ['Inspection Date', reportDetails.inspectionDate],
      ['Prepared By', reportDetails.preparedBy],
      ['Company Name', reportDetails.companyName],
      ['Report Reference', reportDetails.reportReference],
      ['Total Findings', String(findings.length)],
      ['Highest Severity', String(highestSeverity)],
    ]

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.text('Inspection Report', margin, 42)

    doc.setFontSize(12)
    coverRows.forEach(([label, value], index) => {
      const rowY = 72 + index * 12

      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, margin, rowY)
      doc.setFont('helvetica', 'normal')
      doc.text(value || 'Not specified', margin + 55, rowY)
    })

    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('Summary', margin, 24)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    const summaryLines = doc.splitTextToSize(summaryText || 'No summary provided.', contentWidth)
    doc.text(summaryLines, margin, 44)
    const summaryStatsY = 54 + summaryLines.length * 6
    doc.text(`Total findings: ${findings.length}`, margin, summaryStatsY)

    doc.setFont('helvetica', 'bold')
    doc.text('Count per severity', margin, summaryStatsY + 18)
    doc.setFont('helvetica', 'normal')
    ;['1', '2', '3', '4', '5'].forEach((severityLevel, index) => {
      doc.text(
        `Severity ${severityLevel}: ${severityCounts[severityLevel]}`,
        margin,
        summaryStatsY + 30 + index * 8,
      )
    })

    const findingsListY = summaryStatsY + 80
    doc.setFont('helvetica', 'bold')
    doc.text('Findings', margin, findingsListY)
    doc.setFont('helvetica', 'normal')
    findings.forEach((finding, index) => {
      doc.text(`Finding ${index + 1}: Severity ${finding.severity}`, margin, findingsListY + 12 + index * 8)
    })

    for (const [index, finding] of findings.entries()) {
      const renderData = getFindingRenderData(finding)
      if (!renderData) continue

      doc.addPage()

      const image = await readImageData(renderData.image.file)
      const imageRatio = image.width / image.height
      const imageWidth = Math.min(contentWidth, maxImageHeight * imageRatio)
      const imageHeight = imageWidth / imageRatio
      const imageX = (pageWidth - imageWidth) / 2
      const imageY = 40
      const textY = imageY + imageHeight + 16
      const labelWidth = 26
      let detailsY = textY

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text(`Finding ${index + 1}`, margin, 24)

      doc.addImage(image.dataUrl, 'JPEG', imageX, imageY, imageWidth, imageHeight)
      if (
        renderData.annotation &&
        renderData.image.annotations.width > 0 &&
        renderData.image.annotations.height > 0
      ) {
        drawPdfAnnotation(
          doc,
          renderData.annotation,
          imageX,
          imageY,
          imageWidth / renderData.image.annotations.width,
          imageHeight / renderData.image.annotations.height,
        )
      }

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Issue Type:', margin, detailsY)
      doc.setFont('helvetica', 'normal')
      doc.text(finding.issueType || 'Not specified', margin + labelWidth, detailsY)
      detailsY += 10

      doc.setFont('helvetica', 'bold')
      doc.text('Severity:', margin, detailsY)
      doc.setFont('helvetica', 'normal')
      doc.text(finding.severity, margin + labelWidth, detailsY)
      detailsY += 14

      doc.setFont('helvetica', 'bold')
      doc.text('Description:', margin, detailsY)
      doc.setFont('helvetica', 'normal')
      const descriptionLines = doc.splitTextToSize(finding.description || 'Not provided', contentWidth)
      doc.text(descriptionLines, margin, detailsY + 10)
      detailsY += 14 + descriptionLines.length * 6

      doc.setFont('helvetica', 'bold')
      doc.text('Recommendation:', margin, detailsY)
      doc.setFont('helvetica', 'normal')
      const recommendationLines = doc.splitTextToSize(
        finding.recommendation || 'Not provided',
        contentWidth,
      )
      doc.text(recommendationLines, margin, detailsY + 10)
      detailsY += 14 + recommendationLines.length * 6

      if (finding.customFields.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Custom Fields:', margin, detailsY)
        doc.setFont('helvetica', 'normal')
        finding.customFields.forEach((field, fieldIndex) => {
          doc.text(`${field.key}: ${field.value}`, margin, detailsY + 10 + fieldIndex * 8)
        })
      }
    }

    doc.save('drone-report.pdf')
  }

  const renderAnnotationOverlay = (image: InspectionImage, annotation: Annotation) => {
    if (annotation.tool === 'rectangle') {
      return (
        <div
          key={annotation.id}
          className="saved-annotation rectangle"
          style={{
            borderColor: annotation.color,
            left: `${(annotation.x / image.annotations.width) * 100}%`,
            top: `${(annotation.y / image.annotations.height) * 100}%`,
            width: `${(annotation.width / image.annotations.width) * 100}%`,
            height: `${(annotation.height / image.annotations.height) * 100}%`,
          }}
        />
      )
    }

    if (annotation.tool === 'arrow') {
      const markerId = `arrowhead-${annotation.id}`

      return (
        <svg
          key={annotation.id}
          className="saved-annotation-arrow"
          viewBox={`0 0 ${image.annotations.width} ${image.annotations.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill={annotation.color} />
            </marker>
          </defs>
          <line
            x1={annotation.x}
            y1={annotation.y}
            x2={annotation.endX}
            y2={annotation.endY}
            stroke={annotation.color}
            strokeWidth="2"
            markerEnd={`url(#${markerId})`}
          />
        </svg>
      )
    }

    return (
      <div
        key={annotation.id}
        className="saved-annotation-text"
        style={{
          color: annotation.color,
          left: `${(annotation.x / image.annotations.width) * 100}%`,
          top: `${(annotation.y / image.annotations.height) * 100}%`,
        }}
      >
        {annotation.text}
      </div>
    )
  }

  const renderFindingImage = ({ image, annotation }: FindingRenderData) => (
    <div
      className="saved-finding-image"
      style={{
        aspectRatio:
          image.annotations.width > 0 && image.annotations.height > 0
            ? `${image.annotations.width} / ${image.annotations.height}`
            : '4 / 3',
      }}
    >
      <img src={URL.createObjectURL(image.file)} alt="Finding" />
      {image.annotations.width > 0 &&
        image.annotations.height > 0 &&
        annotation &&
        renderAnnotationOverlay(image, annotation)}
    </div>
  )

  const renderFindingDetails = (finding: Finding) => (
    <div className="saved-finding-details">
      <p>
        <strong>Issue Type:</strong> {finding.issueType || 'Not specified'}
      </p>
      <p>
        <strong>Severity:</strong> {finding.severity}
      </p>
      <p>
        <strong>Description:</strong> {finding.description || 'Not provided'}
      </p>
      <p>
        <strong>Recommendation:</strong> {finding.recommendation || 'Not provided'}
      </p>
      {finding.customFields.length > 0 && (
        <div>
          <strong>Custom Fields:</strong>
          <ul className="custom-field-list">
            {finding.customFields.map((field, fieldIndex) => (
              <li key={fieldIndex}>
                {field.key}: {field.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const selectedFindingRenderData = selectedFinding ? getFindingRenderData(selectedFinding) : null
  const previewImage = images[safeReportPreviewPage - 2] ?? null
  const previewImageFindings = previewImage
    ? findings
        .map((finding, index) => ({ finding, index, renderData: getFindingRenderData(finding) }))
        .filter(
          (
            item,
          ): item is { finding: Finding; index: number; renderData: FindingRenderData } =>
            item.renderData !== null && item.renderData.image.id === previewImage.id,
        )
    : []
  const renderFindingsList = () => (
    <section className="panel-section">
      <h2>Findings</h2>
      {findings.length === 0 && <p>No findings added yet.</p>}
      <div className="findings-list">
        {findings.map((finding, index) => {
          const renderData = getFindingRenderData(finding)
          if (!renderData) return null
          const bounds = renderData.annotation ? getAnnotationBounds(renderData.annotation) : null

          return (
            <article
              key={finding.id}
              className={`finding-preview compact ${selectedPage === `finding-${index}` ? 'active' : ''}`}
            >
              <img src={URL.createObjectURL(renderData.image.file)} alt={`Finding ${index + 1}`} />
              <div>
                <h3>Finding {index + 1}</h3>
                <p>Issue Type: {finding.issueType || 'Not specified'}</p>
                <p>Severity: {finding.severity}</p>
                <p>
                  Annotation:{' '}
                  {renderData.annotation && bounds
                    ? `${renderData.annotation.tool} at ${Math.round(bounds.x)}, ${Math.round(bounds.y)}`
                    : 'None'}
                </p>
                <p>{finding.description || 'No description yet.'}</p>
                <div className="preview-actions">
                  <button type="button" onClick={() => editFindingAtIndex(index)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteFindingAtIndex(index)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )

  const renderImagesList = () => (
    <section className="panel-section">
      <h2>Images</h2>
      {images.length === 0 && <p>No images uploaded yet.</p>}
      <div className="sidebar-list">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className={selectedPage === `image-${index}` ? 'active' : ''}
            onClick={() => selectPage(`image-${index}`)}
          >
            Image {index + 1}
          </button>
        ))}
      </div>
    </section>
  )

  const renderReportPagesList = () => (
    <section className="panel-section">
      <h2>Report Pages</h2>
      <div className="sidebar-list">
        <button
          type="button"
          className={selectedPage === 'cover' ? 'active' : ''}
          onClick={() => selectPage('cover')}
        >
          Cover Page
        </button>
        <button
          type="button"
          className={selectedPage === 'summary' ? 'active' : ''}
          onClick={() => selectPage('summary')}
        >
          Summary Page
        </button>
        <button
          type="button"
          className={selectedPage === 'new-finding' ? 'active' : ''}
          onClick={openNewFindingPage}
        >
          + New Finding
        </button>
        <button
          type="button"
          className={selectedPage === 'export' ? 'active' : ''}
          onClick={() => selectPage('export')}
        >
          Export
        </button>
      </div>
    </section>
  )

  const coverRows = [
    ['Project Name', reportDetails.projectName],
    ['Client Name', reportDetails.clientName],
    ['Inspection Type', reportDetails.inspectionType],
    ['Inspection Date', reportDetails.inspectionDate],
    ['Prepared By', reportDetails.preparedBy],
    ['Company Name', reportDetails.companyName],
    ['Report Reference', reportDetails.reportReference],
    ['Total Findings', String(findings.length)],
    ['Highest Severity', String(highestSeverity)],
  ]

  const renderReportPreview = () => (
    <section className="report-page-preview">
      {safeReportPreviewPage === 0 && (
        <div className="report-page a4-page">
          <header className="report-document-header">
            <h2>Inspection Report</h2>
          </header>
          <dl className="report-meta-grid">
            {coverRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Not specified'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {safeReportPreviewPage === 1 && (
        <div className="report-page a4-page">
          <header className="report-document-header">
            <h2>Summary</h2>
          </header>
          <section className="report-section">
            <p>{summaryText || 'No summary provided.'}</p>
          </section>
          <section className="report-section">
            <h3>Count per severity</h3>
            <div className="report-meta-grid compact">
              <div>
                <dt>Total findings</dt>
                <dd>{findings.length}</dd>
              </div>
              <div>
                <dt>Highest severity</dt>
                <dd>{highestSeverity ?? 'None'}</dd>
              </div>
              {['1', '2', '3', '4', '5'].map((severityLevel) => (
                <div key={severityLevel}>
                  <dt>Severity {severityLevel}</dt>
                  <dd>{severityCounts[severityLevel]}</dd>
                </div>
              ))}
            </div>
          </section>
          <section className="report-section">
            <h3>Findings</h3>
            {findings.length === 0 && <p>No findings added yet.</p>}
            {findings.map((finding, index) => (
              <p key={finding.id}>
                Finding {index + 1}: Severity {finding.severity}
              </p>
            ))}
          </section>
        </div>
      )}

      {safeReportPreviewPage > 1 && previewImage && (
        <div className="report-page a4-page finding-report-page">
          <header className="report-document-header">
            <h2>Image {safeReportPreviewPage - 1}</h2>
            <p>{reportDetails.projectName || 'Inspection Report'}</p>
          </header>
          {previewImage && (
            <>
              <div className="report-image-page-frame">
                <img src={URL.createObjectURL(previewImage.file)} alt={`Image ${safeReportPreviewPage - 1}`} />
              </div>
              <p>{previewImage.file.name || `Image ${safeReportPreviewPage - 1}`}</p>
              {previewImageFindings.length === 0 && <p>No findings added for this image yet.</p>}
              {previewImageFindings.map(({ finding, index, renderData }) => (
                <section key={finding.id} className="report-section">
                  <h3>Finding {index + 1}</h3>
                  {renderFindingImage(renderData)}
                  {renderFindingDetails(finding)}
                </section>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )

  const renderEditSurface = () => {
    if (selectedImageIndex !== null && selectedImage) {
      return (
        <ImageUploader
          key={selectedPage}
          imageFile={selectedImage.file}
          annotations={selectedImage.annotations}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          allowAnnotations={false}
          allowUpload={false}
          editorSurface
          uploadMode="replace"
          onImagesUpload={addImages}
          onImageReplace={(file) => replaceImage(selectedImageIndex, file)}
          onAnnotationsChange={(annotations) => updateImageAnnotations(selectedImageIndex, annotations)}
          onAnnotationCreate={() => undefined}
          onSelectedToolChange={setSelectedTool}
          onSelectedColorChange={setSelectedColor}
        />
      )
    }

    if (selectedPage === 'new-finding') {
      return (
        <div className="empty-editor-surface">
          <h2>Upload Images</h2>
          <p>Use the right sidebar to add images, then select an image to create findings.</p>
        </div>
      )
    }

    if (selectedFinding && selectedFindingIndex !== null && selectedFindingRenderData) {
      const selectedFindingImageIndex = images.findIndex(
        (image) => image.id === selectedFindingRenderData.image.id,
      )

      return (
        <ImageUploader
          key={selectedPage}
          imageFile={selectedFindingRenderData.image.file}
          annotations={{
            ...selectedFindingRenderData.image.annotations,
            items: selectedFindingRenderData.annotation ? [selectedFindingRenderData.annotation] : [],
          }}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          allowUpload={false}
          editorSurface
          onImagesUpload={addImages}
          onAnnotationsChange={(annotations) => {
            if (selectedFindingImageIndex !== -1) {
              updateImageAnnotations(selectedFindingImageIndex, {
                ...annotations,
                items: selectedFindingRenderData.image.annotations.items,
              })
            }
          }}
          onAnnotationCreate={(annotation) =>
            attachAnnotationToFinding(selectedFindingIndex, annotation)
          }
          onSelectedToolChange={setSelectedTool}
          onSelectedColorChange={setSelectedColor}
        />
      )
    }

    if (selectedFinding && selectedFindingIndex !== null && !selectedFindingRenderData) {
      return (
        <div className="empty-editor-surface">
          <h2>Missing Image</h2>
          <p>
            Finding {selectedFindingIndex + 1} references image {selectedFinding.imageId}, but that
            image could not be found.
          </p>
        </div>
      )
    }

    return (
      <div className="empty-editor-surface">
        <h2>Edit Mode</h2>
        <p>Select an image or finding from the left sidebar to edit it.</p>
      </div>
    )
  }

  const renderCenterCanvas = () => {
    if (editorMode === 'preview') return renderReportPreview()

    return renderEditSurface()
  }

  const renderRightPanel = () => (
    <>
      {selectedPage === 'cover' && (
        <ReportDetailsForm
          reportDetails={reportDetails}
          onReportDetailsChange={setReportDetails}
        />
      )}

      {selectedPage === 'summary' && (
        <SummaryEditor
          summaryText={summaryText}
          highestSeverity={highestSeverity}
          severityCounts={severityCounts}
          totalFindings={findings.length}
          onSummaryTextChange={setSummaryText}
        />
      )}

      {selectedImageIndex !== null && selectedImage && (
        <section className="card">
          <h2>Image Finding</h2>
          <button type="button" onClick={() => createFindingForImage(selectedImageIndex)}>
            Add Finding
          </button>
        </section>
      )}

      {selectedPage === 'new-finding' && (
        <ImageUploader
          key={selectedPage}
          imageFile={null}
          annotations={createEmptyAnnotations()}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          allowAnnotations={false}
          onImagesUpload={addImages}
          onAnnotationsChange={() => undefined}
          onAnnotationCreate={() => undefined}
          onSelectedToolChange={setSelectedTool}
          onSelectedColorChange={setSelectedColor}
        />
      )}

      {selectedFinding && editingFinding && selectedFindingIndex !== null && selectedFindingRenderData && (
        <>
          {hasUnsavedFindingChanges && (
            <section className="unsaved-indicator" role="status">
              Unsaved changes
            </section>
          )}
          <FindingForm
            issueType={editingFinding.issueType}
            severity={editingFinding.severity}
            description={editingFinding.description}
            recommendation={editingFinding.recommendation}
            customFields={editingFinding.customFields}
            onIssueTypeChange={(issueType) => updateEditingFinding({ issueType })}
            onSeverityChange={(severity) => updateEditingFinding({ severity })}
            onDescriptionChange={(description) => updateEditingFinding({ description })}
            onRecommendationChange={(recommendation) =>
              updateEditingFinding({ recommendation })
            }
            onCustomFieldsChange={(customFields) => updateEditingFinding({ customFields })}
            onSubmit={saveFindingChanges}
            submitLabel="Save Changes"
          />
          <section className="card danger-zone">
            <h2>Delete Finding</h2>
            <button type="button" onClick={deleteFinding}>
              Delete Finding
            </button>
          </section>
        </>
      )}

      {selectedPage === 'export' && <PdfGenerator onGeneratePDF={generatePDF} />}
    </>
  )

  return (
    <main className="app-shell">
      <header className="editor-topbar">
        <h1>Drone Report Builder</h1>
        <div className="topbar-groups">
          <div className="mode-toggle" aria-label="Editor mode">
            <button
              type="button"
              className={editorMode === 'edit' ? 'active' : ''}
              onClick={() => setEditorMode('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={editorMode === 'preview' ? 'active' : ''}
              onClick={switchToPreviewMode}
            >
              Preview
            </button>
          </div>
          <div className="topbar-page-controls">
            <button
              type="button"
              onClick={() => setReportPreviewPage(Math.max(safeReportPreviewPage - 1, 0))}
              disabled={safeReportPreviewPage === 0}
            >
              Previous
            </button>
            <span>
              Page {safeReportPreviewPage + 1} of {reportPagesCount}
            </span>
            <button
              type="button"
              onClick={() =>
                setReportPreviewPage(Math.min(safeReportPreviewPage + 1, reportPagesCount - 1))
              }
              disabled={safeReportPreviewPage === reportPagesCount - 1}
            >
              Next
            </button>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={openNewFindingPage}>+ New Finding</button>
            <button type="button" onClick={generatePDF}>Export PDF</button>
          </div>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="left-sidebar">
          {renderImagesList()}
          {renderFindingsList()}
          {renderReportPagesList()}
        </aside>

        <section className="editor-desk">
          <div className="canvas-frame">
            {renderCenterCanvas()}
          </div>
        </section>

        <aside className="right-sidebar">
          {renderRightPanel()}
        </aside>
      </div>
    </main>
  )
}

export default App
