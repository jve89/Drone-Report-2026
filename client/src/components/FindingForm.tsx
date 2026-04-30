import { useState } from 'react'

type CustomField = {
  key: string
  value: string
}

type FindingFormProps = {
  issueType: string
  severity: string
  description: string
  recommendation: string
  customFields: CustomField[]
  onIssueTypeChange: (issueType: string) => void
  onSeverityChange: (severity: string) => void
  onDescriptionChange: (description: string) => void
  onRecommendationChange: (recommendation: string) => void
  onCustomFieldsChange: (customFields: CustomField[]) => void
  onSubmit: () => void
  submitLabel: string
}

function FindingForm({
  issueType,
  severity,
  description,
  recommendation,
  customFields,
  onIssueTypeChange,
  onSeverityChange,
  onDescriptionChange,
  onRecommendationChange,
  onCustomFieldsChange,
  onSubmit,
  submitLabel,
}: FindingFormProps) {
  const [customFieldKey, setCustomFieldKey] = useState('')
  const [customFieldValue, setCustomFieldValue] = useState('')

  const addCustomField = () => {
    const key = customFieldKey.trim()
    const value = customFieldValue.trim()

    if (!key || !value) return

    onCustomFieldsChange([...customFields, { key, value }])
    setCustomFieldKey('')
    setCustomFieldValue('')
  }

  const removeCustomField = (fieldIndex: number) => {
    onCustomFieldsChange(customFields.filter((_, index) => index !== fieldIndex))
  }

  return (
    <section className="card">
      <h2>Finding Details</h2>
      <div className="field">
        <label>Issue Type:</label>
        <input
          type="text"
          value={issueType}
          onChange={(event) => onIssueTypeChange(event.target.value)}
        />
      </div>
      <div className="field">
        <label>Severity:</label>
        <select value={severity} onChange={(event) => onSeverityChange(event.target.value)}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
      <div className="field">
        <label>Description:</label>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={4}
          cols={50}
        />
      </div>
      <div className="field">
        <label>Recommendation:</label>
        <textarea
          value={recommendation}
          onChange={(event) => onRecommendationChange(event.target.value)}
          rows={4}
          cols={50}
        />
      </div>
      <div className="custom-fields">
        <h3>Custom Fields</h3>
        <div className="custom-field-inputs">
          <input
            type="text"
            placeholder="Key"
            value={customFieldKey}
            onChange={(event) => setCustomFieldKey(event.target.value)}
          />
          <input
            type="text"
            placeholder="Value"
            value={customFieldValue}
            onChange={(event) => setCustomFieldValue(event.target.value)}
          />
          <button type="button" onClick={addCustomField}>
            Add Field
          </button>
        </div>
        {customFields.length > 0 && (
          <ul className="custom-field-list">
            {customFields.map((field, index) => (
              <li key={index}>
                {field.key}: {field.value}
                <button type="button" onClick={() => removeCustomField(index)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={onSubmit}>
        {submitLabel}
      </button>
    </section>
  )
}

export default FindingForm
