const fs = require('fs');
const glob = require('glob');
const path = require('path');

const commandFiles = glob.sync('d:/web/WEB TỔNG HỢP/DASHBOARDTHANGTINHOC/modules/teacher/commands/*.js');

commandFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("require('../../services/TeacherApplicationService')")) {
    content = content.replace("require('../../services/TeacherApplicationService')", "require('../services/TeacherApplicationService')");
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed require in ${path.basename(file)}`);
  }
});
