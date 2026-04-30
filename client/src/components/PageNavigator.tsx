type SelectedPage =
  | 'cover'
  | 'summary'
  | 'new-finding'
  | 'export'
  | `finding-${number}`
  | `draft-${number}`

type PageNavigatorProps = {
  draftFindingsCount: number
  findingsCount: number
  selectedPage: SelectedPage
  onSelectPage: (page: SelectedPage) => void
  onNewFinding: () => void
}

function PageNavigator({
  draftFindingsCount,
  findingsCount,
  selectedPage,
  onSelectPage,
  onNewFinding,
}: PageNavigatorProps) {
  return (
    <nav className="page-nav" aria-label="Report pages">
      <button
        type="button"
        className={selectedPage === 'cover' ? 'active' : ''}
        onClick={() => onSelectPage('cover')}
      >
        Cover Page
      </button>
      <button
        type="button"
        className={selectedPage === 'summary' ? 'active' : ''}
        onClick={() => onSelectPage('summary')}
      >
        Summary Page
      </button>
      {Array.from({ length: findingsCount }, (_, index) => (
        <button
          key={`finding-${index}`}
          type="button"
          className={selectedPage === `finding-${index}` ? 'active' : ''}
          onClick={() => onSelectPage(`finding-${index}`)}
        >
          Finding {index + 1}
        </button>
      ))}
      {Array.from({ length: draftFindingsCount }, (_, index) => (
        <button
          key={`draft-${index}`}
          type="button"
          className={selectedPage === `draft-${index}` ? 'active' : ''}
          onClick={() => onSelectPage(`draft-${index}`)}
        >
          Draft {index + 1}
        </button>
      ))}
      <button
        type="button"
        className={selectedPage === 'new-finding' ? 'active' : ''}
        onClick={onNewFinding}
      >
        + New Finding
      </button>
      <button
        type="button"
        className={selectedPage === 'export' ? 'active' : ''}
        onClick={() => onSelectPage('export')}
      >
        Export
      </button>
    </nav>
  )
}

export type { SelectedPage }
export default PageNavigator
