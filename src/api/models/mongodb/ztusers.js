const mongoose = require('mongoose');

const ztusers = new mongoose.Schema({
  USERID: { type: String, required: true },
  PASSWORD: { type: String },
  USERNAME: { type: String },
  ALIAS: { type: String },
  FIRSTNAME: { type: String },
  LASTNAME: { type: String },
  BIRTHDAYDATE: { type: Date }, 
  COMPANYID: { type: Number },
  COMPANYNAME: { type: String },
  COMPANYALIAS: { type: String },
  CEDIID: { type: String },
  EMPLOYEEID: { type: String },
  EMAIL: { type: String }, // Validación básica de email
  PHONENUMBER: { type: String },
  EXTENSION: { type: String },
  DEPARTMENT: { type: String },
  FUNCTION: { type: String },
  STREET: { type: String },
  POSTALCODE: { type: Number },
  CITY: { type: String },
  REGION: { type: String },
  STATE: { type: String },
  COUNTRY: { type: String },
  AVATAR: { type: String },
  ROLES: [{
    ROLEID: { type: String },
    ROLEIDSAP: { type: String }
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
  "ZTUSERS",
   ztusers,
    "ZTUSERS");