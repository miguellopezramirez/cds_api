const mongoose = require('mongoose');

//Labels

const ztlables = new mongoose.Schema({
    COMPANYID: String,
    CEDIID: String,
    LABELID: String,
    LABEL: String,
    INDEX: String,
    COLLECTION: String,
    SECTION: String,
    SEQUENCE: Number,
    IMAGE: String,
    DESCRIPTION: String,
    DETAIL_ROW: {
      ACTIVED: Boolean,
      DELETED: Boolean,
      DETAIL_ROW_REG: [
        {
          CURRENT: Boolean,
          REGDATE: Date,
          REGTIME: Date,
          REGUSER: String
        }
      ]
    }
  });

module.exports = mongoose.model(
    "ZTLABELS",
    ztlables,
    "ZTLABELS"
);