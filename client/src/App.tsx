import { useState } from 'react'
import jsPDF from 'jspdf'
import FindingForm from './components/FindingForm'
import ImageUploader from './components/ImageUploader'
import PageNavigator from './components/PageNavigator'
import type { SelectedPage } from './components/PageNavigator'
import PdfGenerator from './components/PdfGenerator'
import ReportDetailsForm from './components/ReportDetailsForm'
import SummaryEditor from './components/SummaryEditor'

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

type CustomField = {
  key: string
  value: string
}

type FindingBase = {
  image: File
  issueType: string
  severity: string
  description: string
  recommendation: string
  customFields: CustomField[]
  annotations: ImageAnnotations
}

type Finding = FindingBase
type DraftFinding = FindingBase

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

const emptyAnnotations: ImageAnnotations = {
  width: 0,
  height: 0,
  items: [],
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

const createDraftFinding = (image: File): DraftFinding => ({
  image,
  issueType: '',
  severity: '1',
  description: '',
  recommendation: '',
  customFields: [],
  annotations: emptyAnnotations,
})

const copyFinding = (finding: FindingBase): FindingBase => ({
  ...finding,
  customFields: [...finding.customFields],
  annotations: {
    ...finding.annotations,
    items: [...finding.annotations.items],
  },
})

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

const getSelectedIndex = (selectedPage: SelectedPage, prefix: 'finding' | 'draft') => {
  if (!selectedPage.startsWith(`${prefix}-`)) return null

  return Number(selectedPage.replace(`${prefix}-`, ''))
}

function App() {
  const [selectedPage, setSelectedPage] = useState<SelectedPage>('cover')
  const [reportPreviewPage, setReportPreviewPage] = useState(0)
  const [reportDetails, setReportDetails] = useState<ReportDetails>(emptyReportDetails)
  const [summaryText, setSummaryText] = useState('')
  const [findings, setFindings] = useState<Finding[]>([])
  const [draftFindings, setDraftFindings] = useState<DraftFinding[]>([])
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null)
  const [selectedTool, setSelectedTool] = useState<AnnotationTool>('rectangle')
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>('red')

  const selectedFindingIndex = getSelectedIndex(selectedPage, 'finding')
  const selectedDraftIndex = getSelectedIndex(selectedPage, 'draft')
  const selectedFinding =
    selectedFindingIndex === null ? null : findings[selectedFindingIndex] ?? null
  const selectedDraft =
    selectedDraftIndex === null ? null : draftFindings[selectedDraftIndex] ?? null

  const severityCounts = findings.reduce<Record<string, number>>(
    (counts, finding) => ({
      ...counts,
      [finding.severity]: counts[finding.severity] + 1,
    }),
    { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  )
  const highestSeverity =
    findings.length > 0 ? Math.max(...findings.map((finding) => Number(finding.severity))) : null

  const allPreviewFindings = [...findings, ...draftFindings]
  const reportPagesCount = 2 + findings.length
  const safeReportPreviewPage = Math.min(reportPreviewPage, reportPagesCount - 1)

  const updateDraft = (draftIndex: number, updates: Partial<DraftFinding>) => {
    setDraftFindings((currentDrafts) =>
      currentDrafts.map((draft, index) =>
        index === draftIndex ? { ...draft, ...updates } : draft,
      ),
    )
  }

  const replaceDraftImage = (draftIndex: number, image: File) => {
    updateDraft(draftIndex, { image, annotations: emptyAnnotations })
  }

  const updateEditingFinding = (updates: Partial<Finding>) => {
    if (!editingFinding) return

    setEditingFinding({ ...editingFinding, ...updates })
  }

  const replaceEditingImage = (image: File) => {
    updateEditingFinding({ image, annotations: emptyAnnotations })
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

  const addDraftsFromImages = (images: File[]) => {
    if (images.length === 0) return

    const firstNewDraftIndex = draftFindings.length
    setDraftFindings([...draftFindings, ...images.map(createDraftFinding)])
    setEditingFinding(null)
    setSelectedPage(`draft-${firstNewDraftIndex}`)
  }

  const openNewFindingPage = () => {
    setEditingFinding(null)
    setSelectedPage('new-finding')
  }

  const addFinding = () => {
    if (selectedDraftIndex === null || !selectedDraft) return

    const savedFindingIndex = findings.length
    setFindings([...findings, selectedDraft])
    setDraftFindings(draftFindings.filter((_, index) => index !== selectedDraftIndex))
    setEditingFinding(copyFinding(selectedDraft))
    setSelectedPage(`finding-${savedFindingIndex}`)
  }

  const saveFindingChanges = () => {
    if (selectedFindingIndex === null || !editingFinding) return

    setFindings((currentFindings) =>
      currentFindings.map((finding, index) =>
        index === selectedFindingIndex ? editingFinding : finding,
      ),
    )
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
    setEditingFinding(null)
    setReportPreviewPage((currentPage) => Math.min(currentPage, remainingFindings.length + 1))

    if (selectedFindingIndex !== null && selectedFindingIndex === findingIndex) {
      if (findingIndex < remainingFindings.length) {
        setEditingFinding(copyFinding(remainingFindings[findingIndex]))
        setSelectedPage(`finding-${findingIndex}`)
        return
      }

      setSelectedPage('summary')
      return
    }
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
      doc.addPage()

      const image = await readImageData(finding.image)
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
      if (finding.annotations.width > 0 && finding.annotations.height > 0) {
        const annotationScaleX = imageWidth / finding.annotations.width
        const annotationScaleY = imageHeight / finding.annotations.height

        doc.setLineWidth(1.2)
        finding.annotations.items.forEach((annotation) => {
          const [red, green, blue] = annotationColors[annotation.color]

          doc.setDrawColor(red, green, blue)
          if (annotation.tool === 'rectangle') {
            doc.rect(
              imageX + annotation.x * annotationScaleX,
              imageY + annotation.y * annotationScaleY,
              annotation.width * annotationScaleX,
              annotation.height * annotationScaleY,
            )
          } else {
            doc.ellipse(
              imageX + (annotation.x + annotation.width / 2) * annotationScaleX,
              imageY + (annotation.y + annotation.height / 2) * annotationScaleY,
              (annotation.width * annotationScaleX) / 2,
              (annotation.height * annotationScaleY) / 2,
            )
          }
        })
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

  const renderFindingImage = (finding: FindingBase) => (
    <div
      className="saved-finding-image"
      style={{
        aspectRatio:
          finding.annotations.width > 0 && finding.annotations.height > 0
            ? `${finding.annotations.width} / ${finding.annotations.height}`
            : '4 / 3',
      }}
    >
      <img src={URL.createObjectURL(finding.image)} alt="Finding" />
      {finding.annotations.width > 0 &&
        finding.annotations.height > 0 &&
        finding.annotations.items.map((annotation, annotationIndex) => (
          <div
            key={annotationIndex}
            className={`saved-annotation ${annotation.tool}`}
            style={{
              borderColor: annotation.color,
              left: `${(annotation.x / finding.annotations.width) * 100}%`,
              top: `${(annotation.y / finding.annotations.height) * 100}%`,
              width: `${(annotation.width / finding.annotations.width) * 100}%`,
              height: `${(annotation.height / finding.annotations.height) * 100}%`,
            }}
          />
        ))}
    </div>
  )

  const renderFindingDetails = (finding: FindingBase) => (
    <div className="saved-finding-details">
      <p>Issue Type: {finding.issueType || 'Not specified'}</p>
      <p>Severity: {finding.severity}</p>
      <p>Description: {finding.description || 'Not provided'}</p>
      {finding.recommendation && <p>Recommendation: {finding.recommendation}</p>}
      {finding.customFields.length > 0 && (
        <ul className="custom-field-list">
          {finding.customFields.map((field, fieldIndex) => (
            <li key={fieldIndex}>
              {field.key}: {field.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Drone Report Builder</h1>
      </header>

      <div className="app-layout">
        <div className="workflow-column">
          <PageNavigator
            draftFindingsCount={draftFindings.length}
            findingsCount={findings.length}
            selectedPage={selectedPage}
            onSelectPage={selectPage}
            onNewFinding={openNewFindingPage}
          />

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

          {selectedDraftIndex !== null && selectedDraft && (
            <>
              <ImageUploader
                key={selectedPage}
                imageFile={selectedDraft.image}
                annotations={selectedDraft.annotations}
                selectedTool={selectedTool}
                selectedColor={selectedColor}
                uploadMode="replace"
                onImagesUpload={addDraftsFromImages}
                onImageReplace={(image) => replaceDraftImage(selectedDraftIndex, image)}
                onAnnotationsChange={(annotations) => updateDraft(selectedDraftIndex, { annotations })}
                onSelectedToolChange={setSelectedTool}
                onSelectedColorChange={setSelectedColor}
              />
              <FindingForm
                issueType={selectedDraft.issueType}
                severity={selectedDraft.severity}
                description={selectedDraft.description}
                recommendation={selectedDraft.recommendation}
                customFields={selectedDraft.customFields}
                onIssueTypeChange={(issueType) => updateDraft(selectedDraftIndex, { issueType })}
                onSeverityChange={(severity) => updateDraft(selectedDraftIndex, { severity })}
                onDescriptionChange={(description) => updateDraft(selectedDraftIndex, { description })}
                onRecommendationChange={(recommendation) =>
                  updateDraft(selectedDraftIndex, { recommendation })
                }
                onCustomFieldsChange={(customFields) =>
                  updateDraft(selectedDraftIndex, { customFields })
                }
                onSubmit={addFinding}
                submitLabel="Add Finding"
              />
            </>
          )}

          {selectedPage === 'new-finding' && (
            <ImageUploader
              key={selectedPage}
              imageFile={null}
              annotations={emptyAnnotations}
              selectedTool={selectedTool}
              selectedColor={selectedColor}
              onImagesUpload={addDraftsFromImages}
              onAnnotationsChange={() => undefined}
              onSelectedToolChange={setSelectedTool}
              onSelectedColorChange={setSelectedColor}
            />
          )}

          {selectedFinding && editingFinding && selectedFindingIndex !== null && (
            <>
              <ImageUploader
                key={selectedPage}
                imageFile={editingFinding.image}
                annotations={editingFinding.annotations}
                selectedTool={selectedTool}
                selectedColor={selectedColor}
                uploadMode="replace"
                onImagesUpload={addDraftsFromImages}
                onImageReplace={replaceEditingImage}
                onAnnotationsChange={(annotations) => updateEditingFinding({ annotations })}
                onSelectedToolChange={setSelectedTool}
                onSelectedColorChange={setSelectedColor}
              />
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
        </div>

        <aside className="preview-column">
          <section className="card">
            <h2>Findings List Preview</h2>
            {allPreviewFindings.length === 0 && <p>No findings added yet.</p>}
            <div className="findings-list">
              {allPreviewFindings.map((finding, index) => (
                <article key={`${finding.image.name}-${index}`} className="finding-preview compact">
                  <img src={URL.createObjectURL(finding.image)} alt={`Finding ${index + 1}`} />
                  <div>
                    <h3>
                      {index < findings.length ? `Finding ${index + 1}` : `Draft ${index - findings.length + 1}`}
                    </h3>
                    <p>Issue Type: {finding.issueType || 'Not specified'}</p>
                    <p>Severity: {finding.severity}</p>
                    <p>{finding.description || 'No description yet.'}</p>
                    {index < findings.length && (
                      <div className="preview-actions">
                        <button type="button" onClick={() => editFindingAtIndex(index)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteFindingAtIndex(index)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card report-page-preview">
            <h2>Report Page Preview</h2>
            <div className="button-row">
              <button
                type="button"
                onClick={() => setReportPreviewPage(Math.max(safeReportPreviewPage - 1, 0))}
                disabled={safeReportPreviewPage === 0}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setReportPreviewPage(Math.min(safeReportPreviewPage + 1, reportPagesCount - 1))
                }
                disabled={safeReportPreviewPage === reportPagesCount - 1}
              >
                Next
              </button>
              <span>
                Page {safeReportPreviewPage + 1} of {reportPagesCount}
              </span>
            </div>

            {safeReportPreviewPage === 0 && (
              <div className="report-page">
                <h3>Inspection Report</h3>
                <p>Project Name: {reportDetails.projectName || 'Not specified'}</p>
                <p>Client Name: {reportDetails.clientName || 'Not specified'}</p>
                <p>Inspection Type: {reportDetails.inspectionType || 'Not specified'}</p>
                <p>Total Findings: {findings.length}</p>
                <p>Highest Severity: {highestSeverity ?? 'None'}</p>
              </div>
            )}

            {safeReportPreviewPage === 1 && (
              <div className="report-page">
                <h3>Summary</h3>
                <p>{summaryText || 'No summary provided.'}</p>
                <p>Total findings: {findings.length}</p>
                <p>Highest severity: {highestSeverity ?? 'None'}</p>
              </div>
            )}

            {safeReportPreviewPage > 1 && findings[safeReportPreviewPage - 2] && (
              <div className="report-page">
                <h3>Finding {safeReportPreviewPage - 1}</h3>
                {renderFindingImage(findings[safeReportPreviewPage - 2])}
                {renderFindingDetails(findings[safeReportPreviewPage - 2])}
                <div className="preview-actions">
                  <button type="button" onClick={() => editFindingAtIndex(safeReportPreviewPage - 2)}>
                    Edit Finding
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFindingAtIndex(safeReportPreviewPage - 2)}
                  >
                    Delete Finding
                  </button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

export default App
