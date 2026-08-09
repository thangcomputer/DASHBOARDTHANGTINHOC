const ReportDefinitionRepository = require('./ReportDefinitionRepository');
const ReportDefinition = require('../models/ReportDefinition');

class MongoReportDefinitionRepository extends ReportDefinitionRepository {
  constructor() {
    super(ReportDefinition);
  }
}

module.exports = MongoReportDefinitionRepository;
