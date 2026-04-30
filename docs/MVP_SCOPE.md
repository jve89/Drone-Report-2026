# MVP_SCOPE.md

## Goal
User can create a complete inspection report and export a clean PDF without confusion.

## Included Features
1. Project creation (name, client, date)
2. Image upload (multiple, selectable)
3. Create findings:
   - severity (1–5)
   - issue type (dropdown + custom)
   - description
   - recommendation
   - custom fields (key-value)
4. Image annotation:
   - rectangle
   - arrow
   - text label
5. Findings list view
6. Report preview (HTML)
7. PDF export

## Excluded Features
- No drag-and-drop editor
- No templates marketplace
- No accounts (v1)
- No collaboration
- No advanced annotation tools
- No AI features

## Fixed Structure
Cover → Summary → Findings → End

## Success Criteria
- Report created in <15 min
- Clean, professional output
- Handles 20+ findings

## Build Order
1. Data structure + UI shell
2. Image upload + findings
3. Annotation layer
4. Report rendering
5. PDF export
