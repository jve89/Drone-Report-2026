type PdfGeneratorProps = {
  onGeneratePDF: () => Promise<void>
}

function PdfGenerator({ onGeneratePDF }: PdfGeneratorProps) {
  return (
    <section className="card">
      <h2>Export</h2>
      <button onClick={onGeneratePDF}>Generate PDF</button>
    </section>
  )
}

export default PdfGenerator
