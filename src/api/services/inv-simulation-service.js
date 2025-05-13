const ztsimulation = require('../models/mongodb/ztsimulation');

/**
 * Elimina físicamente una simulación de la base de datos por su ID y usuario.
 */
async function deleteSimulation(idSimulation, idUser) {
  if (!idSimulation || !idUser) {
    throw new Error("Parámetros incompletos: se requiere idSimulation y idUser.");
  }

  const deleted = await ztsimulation.findOneAndDelete({ idSimulation, idUser });

  if (!deleted) {
    throw new Error("No se encontró la simulación para eliminar.");
  }

  return {
    message: "Simulación eliminada permanentemente.",
    idSimulation: deleted.idSimulation,
    user: deleted.idUser,
  };
}

module.exports = {
  deleteSimulation
};
