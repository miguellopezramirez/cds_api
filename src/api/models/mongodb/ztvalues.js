const mongoose = require('mongoose');

// Values

const ztvalues = new mongoose.Schema({
    COMPANYID: { type: String },
    CEDIID: { type: String },
    LABELID: { type: String, required: true },
    VALUEPAID: { type: String }, // valor padre (opcional)
    VALUEID: { type: String, required: true },
    VALUE: { type: String, required: true },
    ALIAS: { type: String },
    SEQUENCE: { type: Number },
    IMAGE: { type: String },
    DESCRIPTION: { type: String },
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
    "ZTVALUES",
    ztvalues,
    "ZTVALUES"
);
