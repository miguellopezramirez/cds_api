const ztsimulation = require('../models/mongodb/ztsimulation');

// 🔍 Obtener simulaciones
async function getAllSimulaciones(req) {
  try {
    const idUser = req.req.body?.idUser;
    const idSimulation = req.req.query?.id;
    let simulation;

    if (idSimulation != null) {
      simulation = await ztsimulation.findOne({ idSimulation }).lean();
    } else {
      simulation = await ztsimulation.find({ idUser }).lean();
    }

    return simulation;
  } catch (e) {
    console.error("Error en GetAllSimulaciones:", e);
    throw e;
  }
}

//  Borrar simulación (lógico o físico)
async function deleteSimulation(idSimulation, idUser, type = "fisic") {
  if (!idSimulation || !idUser) {
    throw new Error("Parámetros incompletos: se requiere idSimulation y idUser.");
  }

  if (type === "fisic") {
    const deleted = await ztsimulation.findOneAndDelete({ idSimulation, idUser });
    if (!deleted) throw new Error("No se encontró la simulación para eliminar.");
    return {
      message: "Simulación eliminada permanentemente.",
      idSimulation: deleted.idSimulation,
      user: deleted.idUser,
    };
  }

  if (type === "logic") {
    const simulacion = await ztsimulation.findOne({ idSimulation, idUser });
    if (!simulacion) throw new Error("Simulación no encontrada para borrado lógico.");

    // Validar si ya fue marcada como eliminada lógicamente
    const yaEliminada = simulacion.DETAIL_ROW?.[0]?.DELETED === true;
    if (yaEliminada) {
      throw new Error("La simulación ya fue eliminada lógicamente previamente.");
    }

    const now = new Date();
    const newRegistro = {
      CURRENT: true,
      REGDATE: now,
      REGTIME: now,
      REGUSER: "MIGUEL"
    };

    // Inactivar registros actuales
    simulacion.DETAIL_ROW?.[0]?.DETAIL_ROW_REG?.forEach(r => r.CURRENT = false);

    // Agregar nuevo registro
    simulacion.DETAIL_ROW = simulacion.DETAIL_ROW || [{}];
    simulacion.DETAIL_ROW[0].DELETED = true;
    simulacion.DETAIL_ROW[0].ACTIVED = false;
    simulacion.DETAIL_ROW[0].DETAIL_ROW_REG = simulacion.DETAIL_ROW[0].DETAIL_ROW_REG || [];
    simulacion.DETAIL_ROW[0].DETAIL_ROW_REG.push(newRegistro);

    await simulacion.save();

    return {
      message: "Simulación actualizada con borrado lógico.",
      idSimulation,
      user: idUser
    };
    
  }

  throw new Error("Tipo de borrado no reconocido. Usa 'fisic' o 'logic'.");
}
// ✏️ Actualizar nombre
const updateSimulationName = async (idSimulation, newName) => {
  if (!idSimulation || !newName) throw new Error("Faltan parámetros obligatorios");
  const updated = await ztsimulation.findOneAndUpdate(
    { idSimulation },
    { simulationName: newName },
    { new: true }
  );
  if (!updated) throw new Error("Simulación no encontrada");
  return updated;
};

module.exports = {
  updateSimulationName,
  deleteSimulation,
  getAllSimulaciones
};
