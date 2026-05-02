type SelectedPage =
  | 'cover'
  | 'summary'
  | 'new-finding'
  | 'export'
  | `finding-${number}`
  | `image-${number}`

type PageNavigatorProps = {
  imageCount: number
  findingsCount: number
  selectedPage: SelectedPage
  onSelectPage: (page: SelectedPage) => void
  onNewFinding: () => void
}

function PageNavigator({
  imageCount,
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
      {Array.from({ length: imageCount }, (_, index) => (
        <button
          key={`image-${index}`}
          type="button"
          className={selectedPage === `image-${index}` ? 'active' : ''}
          onClick={() => onSelectPage(`image-${index}`)}
        >
          Image {index + 1}
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
