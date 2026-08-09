'use strict';

const { commandBus, commandRegistry } = require('../../../shared/cqrs');
const StudentApplicationOrchestrator = require('../services/StudentApplicationOrchestrator');
const CreateStudentHandler = require('../commands/CreateStudentHandler');
const CreateInvoiceHandler = require('../../finance/commands/CreateInvoiceHandler');

// Register handlers dynamically for this proof of concept to avoid touching a global bootloader
commandRegistry.register('CreateStudentCommand', CreateStudentHandler);
commandRegistry.register('CreateInvoiceCommand', CreateInvoiceHandler);

const orchestrator = new StudentApplicationOrchestrator(commandBus);

class CQRSStudentController {
  async create(req, res, next) {
    try {
      const payload = {
        actorId: req.user ? req.user._id : null,
        tenantId: req.user ? req.user.tenantId : null,
        branchId: req.userBranchId || req.body.branchId, // From branchFilter middleware
        studentData: req.body // Raw validation should happen in orchestrator/command
      };

      const result = await orchestrator.createStudentWithInvoice(payload);

      // Extract raw DTO for legacy compatibility
      let responseDTO = {
        ...result,
      };

      res.status(201).json({
        success: true,
        data: responseDTO,
        message: 'Tạo học viên thành công (CQRS Path)'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CQRSStudentController();
