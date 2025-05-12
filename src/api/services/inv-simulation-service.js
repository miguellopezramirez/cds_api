const ztsimulation = require("../models/mongodb/ztsimulation");

const updateSimulationName = async (idSimulation, newName) => {
  if (!idSimulation || !newName) {
    throw new Error("Faltan parámetros obligatorios");
  }

  const updated = await ztsimulation.findOneAndUpdate(
    { idSimulation },
    { simulationName: newName },
    { new: true }
  );

  if (!updated) {
    throw new Error("Simulación no encontrada");
  }

  return updated;
};

module.exports = {
  updateSimulationName,
};
