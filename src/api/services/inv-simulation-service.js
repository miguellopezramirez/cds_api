const ztsimulation = require('../models/mongodb/ztsimulation');
//funciones date 
function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatTime(date) {
  return date.toTimeString().split(' ')[0]; // HH:mm:ss
}

// 🔍 Obtener simulaciones
async function getAllSimulaciones(req) {
  try {
    const idUser = req.req.body?.idUser;
    const idSimulation = req.req.query?.id;
    const date = req.req.query?.date; // fecha única

    // Construir filtro dinámicamente con búsqueda parcial
    const filter = {};
    if (idUser) filter.idUser = idUser;
    if (idSimulation) filter.idSimulation = { $regex: idSimulation, $options: 'i' };

     // Filtrado por fechas
        if (date) {
      // Buscar simulaciones creadas a partir de esa fecha (aproximada)
      const start = new Date(date);
      filter.createdAt = { $gte: start };
    }  
    console.log(filter)
    // Si no hay filtros, devuelve todo
    const simulation = Object.keys(filter).length > 0
      ? await ztsimulation.find(filter).lean()
      : await ztsimulation.find().lean();

    return simulation;
  } catch (e) {
    console.error("Error en GetAllSimulaciones:", e);
    throw e;
  }
}

// 🗑️ Borrar simulación (lógico o físico)
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
      REGUSER: idUser
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

// ✏️ Actualizar nombre Y registrar nueva modificación
const updateSimulationName = async (idSimulation, newName, idUser) => {
  if (!idSimulation || !newName || !idUser) {
    throw new Error("Faltan parámetros obligatorios: idSimulation, newName o idUser");
  }

  const simulation = await ztsimulation.findOne({ idSimulation });
  if (!simulation) throw new Error("Simulación no encontrada");

  // Actualizar nombre
  simulation.simulationName = newName;

  // Crear nuevo registro
  const now = new Date();
  const newRegistro = {
    CURRENT: true,
    REGDATE: formatDate(now),
    REGTIME: formatTime(now),
    REGUSER: idUser
  };

  // Inactivar anteriores
  if (!simulation.DETAIL_ROW || simulation.DETAIL_ROW.length === 0) {
    simulation.DETAIL_ROW = [{
      ACTIVED: true,
      DELETED: false,
      DETAIL_ROW_REG: [newRegistro]
    }];
  } else {
    const detalle = simulation.DETAIL_ROW[0];

    if (!detalle.DETAIL_ROW_REG) {
      detalle.DETAIL_ROW_REG = [];
    } else {
      detalle.DETAIL_ROW_REG.forEach(r => r.CURRENT = false);
    }

    detalle.DETAIL_ROW_REG.push(newRegistro);
    detalle.ACTIVED = true;
    detalle.DELETED = false;
  }

  await simulation.save();

  return {
    message: "Simulación actualizada correctamente",
    idSimulation: simulation.idSimulation,
    newName: simulation.simulationName
  };
};


module.exports = {
  updateSimulationName,
  deleteSimulation,
  getAllSimulaciones
};
