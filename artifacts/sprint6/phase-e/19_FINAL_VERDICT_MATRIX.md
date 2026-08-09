# 19. FINAL VERDICT MATRIX
| Runtime Node | File | Function | Executed? | Evidence |
|--------------|------|----------|-----------|----------|
| Controller | CQRSStudentController.js | create | Yes | Test Script Logs |
| Orchestrator | StudentApplicationOrchestrator.js | createStudentWithInvoice | Yes | Test Script Logs |
| Command | CreateStudentHandler.js | execute | Yes | Test Script Logs |
| Transaction | TransactionManager.js | execute | No | MongoServerError (Code 20) |