const mongoose = require('mongoose');

const ztroles = new mongoose.Schema({
  ROLEID: { type: String, required: true },
  ROLENAME: { type: String },
  DESCRIPTION: { type: String },
  PRIVILEGES: [{
    PROCESSID: { type: String },
    PRIVILEGEID: [{ type: String}] 
  }],
  DETAIL_ROW: {
    ACTIVED: { type: Boolean, default: true },
    DELETED: { type: Boolean, default: false },
    DETAIL_ROW_REG: [{
      CURRENT: { type: Boolean, default: false },
      REGDATE: { type: Date },
      REGTIME: { type: Date }, 
      REGUSER: { type: String }
    }]
  }
});

module.exports = mongoose.model(
    "ZTROLES", 
    ztroles,
     "ZTROLES"
);