'use strict';

class TeacherMapper {
  static fromCreateDTO(command) { return { ...command }; }
  static fromUpdateDTO(command) { return { ...command }; }
  static toEntity(dto) { return { ...dto }; }
  static toResponse(entity) { return { ...entity }; }
  static toSummary(entity) { return { ...entity }; }
  static toDetail(entity) { return { ...entity }; }
}

module.exports = TeacherMapper;
