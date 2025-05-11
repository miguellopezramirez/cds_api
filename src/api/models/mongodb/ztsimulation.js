const mongoose = require('mongoose');

const DetailRowRegSchema = new mongoose.Schema({
  CURRENT: { type: Boolean, required: true },
  REGDATE: { type: Date, required: true },
  REGTIME: { type: Date, required: true },
  REGUSER: { type: String, required: true }
}, { _id: false });

const DetailRowSchema = new mongoose.Schema({
  ACTIVED: { type: Boolean, required: true },
  DELETED: { type: Boolean, required: true },
  DETAIL_ROW_REG: { type: [DetailRowRegSchema], required: true }
}, { _id: false });

const SignalSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  price: { type: Number, required: true },
  reasoning: { type: String } // Puede ser opcional si aún no se define siempre
}, { _id: false });

const SimulationSchema = new mongoose.Schema({
  idSimulation: { type: String, required: true, unique: true },
  idUser: { type: String, required: true },
  idStrategy: { type: String, required: true },
  simulationName: { type: String, required: true },
  symbol: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  amount: { type: Number, required: true }, // USD
  signals: { type: [SignalSchema], default: [] },
  specs: { type: String },
  result: { type: Number },
  percentageReturn: { type: Number },
  DETAIL_ROW: { type: [DetailRowSchema], default: [] }
}, {
  timestamps: true
});

module.exports = mongoose.model('ZTSIMULATION', SimulationSchema, 'ZTSIMULATION');
