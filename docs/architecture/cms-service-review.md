# CMS & Blog Service Review — Sprint 4.3 Batch 4

## Domains: `cms`, `blog`

### Architecture Before Batch 4
- The CMS domain handled complex workflow state transitions and dynamic page building inside `builderRoutes.js` and `workflowRoutes.js`.
- The Blog domain managed HTML publishing pipelines inside `blogRoutes.js`.

### Architecture After Batch 4
- `CmsApplicationService.js` and `CmsController.js` created.
- `BlogApplicationService.js` and `BlogController.js` created.
- Business rules are seamlessly routed through the application layer, guaranteeing that workflow locks and publishing rules apply irrespective of the network protocol.

### Boundary Compliance
- ✅ Controllers only orchestrate HTTP properties.
- ✅ CMS data mutations only occur inside `CmsApplicationService`.
