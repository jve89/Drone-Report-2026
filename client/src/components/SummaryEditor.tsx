type SummaryEditorProps = {
  summaryText: string
  highestSeverity: number | null
  severityCounts: Record<string, number>
  totalFindings: number
  onSummaryTextChange: (summaryText: string) => void
}

function SummaryEditor({
  summaryText,
  highestSeverity,
  severityCounts,
  totalFindings,
  onSummaryTextChange,
}: SummaryEditorProps) {
  return (
    <section className="card">
      <h2>Summary Page</h2>
      <div className="field">
        <label>Summary Text:</label>
        <textarea
          value={summaryText}
          onChange={(event) => onSummaryTextChange(event.target.value)}
          rows={6}
        />
      </div>
      <div className="stats-list">
        <p>Total findings: {totalFindings}</p>
        <p>Highest severity: {highestSeverity ?? 'None'}</p>
        {['1', '2', '3', '4', '5'].map((severity) => (
          <p key={severity}>
            Severity {severity}: {severityCounts[severity]}
          </p>
        ))}
      </div>
    </section>
  )
}

export default SummaryEditor
