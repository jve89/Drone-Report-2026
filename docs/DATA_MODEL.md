# DATA_MODEL.md

## Core Entities

### Project
- id
- name
- clientName
- date
- findings[]

### Finding
- id
- imageId
- severity (1–5)
- issueType
- description
- recommendation
- annotations[]
- customFields[]

### Image
- id
- filePath

### Annotation
- id
- type (arrow, rectangle, text)
- coordinates
- label

### CustomField
- id
- key
- value
