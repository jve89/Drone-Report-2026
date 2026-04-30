type ReportDetails = {
  projectName: string
  clientName: string
  inspectionType: string
  inspectionDate: string
  preparedBy: string
  companyName: string
  reportReference: string
}

type ReportDetailsFormProps = {
  reportDetails: ReportDetails
  onReportDetailsChange: (reportDetails: ReportDetails) => void
}

function ReportDetailsForm({ reportDetails, onReportDetailsChange }: ReportDetailsFormProps) {
  const updateField = (field: keyof ReportDetails, value: string) => {
    onReportDetailsChange({ ...reportDetails, [field]: value })
  }

  return (
    <section className="card">
      <h2>Report Details</h2>
      <div className="field">
        <label>Project Name:</label>
        <input
          type="text"
          value={reportDetails.projectName}
          onChange={(event) => updateField('projectName', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Client Name:</label>
        <input
          type="text"
          value={reportDetails.clientName}
          onChange={(event) => updateField('clientName', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Inspection Type:</label>
        <input
          type="text"
          value={reportDetails.inspectionType}
          onChange={(event) => updateField('inspectionType', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Inspection Date:</label>
        <input
          type="date"
          value={reportDetails.inspectionDate}
          onChange={(event) => updateField('inspectionDate', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Prepared By:</label>
        <input
          type="text"
          value={reportDetails.preparedBy}
          onChange={(event) => updateField('preparedBy', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Company Name:</label>
        <input
          type="text"
          value={reportDetails.companyName}
          onChange={(event) => updateField('companyName', event.target.value)}
        />
      </div>
      <div className="field">
        <label>Report Reference:</label>
        <input
          type="text"
          value={reportDetails.reportReference}
          onChange={(event) => updateField('reportReference', event.target.value)}
        />
      </div>
    </section>
  )
}

export default ReportDetailsForm
