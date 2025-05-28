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
    throw new Error("Faltan parámetros: idSimulation y idUser.");
  }

  const query = { SIMULATIONID: idSimulation, USERID: idUser };

  if (type === "logic") {
    const simulacion = await ztsimulation.findOne(query);
    if (!simulacion) throw new Error("Simulación no encontrada.");

    const detailRow = simulacion.DETAIL_ROW?.[0] || simulacion.DETAIL_ROW;

    // ✅ Validación fuerte: ya está eliminada
    if (detailRow?.DELETED === true || detailRow?.ACTIVED === false) {
      throw new Error("❌ Esta simulación ya fue eliminada lógicamente.");
    }

    const now = new Date().toISOString();

    const registrosActualizados = (detailRow?.DETAIL_ROW_REG || []).map(r => ({
      ...r,
      CURRENT: false
    }));

    const nuevoRegistro = {
      CURRENT: true,
      REGDATE: now,
      REGTIME: now,
      REGUSER: "MIGUEL"
    };

    registrosActualizados.push(nuevoRegistro);

    await ztsimulation.updateOne(query, {
      $set: {
        "DETAIL_ROW.DELETED": true,
        "DETAIL_ROW.ACTIVED": false,
        "DETAIL_ROW.DETAIL_ROW_REG": registrosActualizados
      }
    });

    return {
      message: "✅ Simulación eliminada lógicamente.",
      idSimulation,
      user: idUser
    };
  }

  if (type === "fisic") {
    const deleted = await ztsimulation.findOneAndDelete(query);
    if (!deleted) throw new Error("No se encontró la simulación para eliminar.");
    return {
      message: "🗑️ Simulación eliminada permanentemente.",
      idSimulation: deleted.SIMULATIONID,
      user: deleted.USERID
    };
  }

  throw new Error("Tipo no válido. Usa 'logic' o 'fisic'.");
}



//  Actualizar nombre
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
