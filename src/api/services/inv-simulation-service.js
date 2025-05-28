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
    const idUser = req.req.query?.idUser;// id del usuario
    const idSimulation = req.req.query?.id;//paramtros de la id de simulacion
    const dateI = req.req.query?.dateI;  // inicio de rango (YYYY-MM-DD)
    var dateF = req.req.query?.dateF;  // fin de rango (YYYY-MM-DD)


    // Construir filtro dinámicamente con búsqueda parcial
    const filter = {};
    if (idUser) filter.USERID = idUser;
    if (idSimulation) filter.SIMULATIONID = { $regex: idSimulation, $options: 'i' };

     
    if (dateI && !dateF) {
     //Asignar a fecha de fin la fecha actual
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateF = `${yyyy}-${mm}-${dd}`;
    }
      
    // Buscar por rango de fechas en SIMULATIONID
    if (dateI && dateF) {
      // Generar todas las fechas del rango
      const datesInRange = [];
      let current = new Date(dateI);
      const end = new Date(dateF);
      while (current <= end) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate() + 1).padStart(2, '0');
        datesInRange.push(`${yyyy}-${mm}-${dd}`);
        current.setDate(current.getDate() + 1);
      }
      // Crear regex que busque cualquiera de las fechas en el rango
      const regexRange = datesInRange.join('|');
      filter.SIMULATIONID = { $regex: regexRange, $options: 'i' };
    }

    // Si no hay filtros, devuelve todo
    const simulation = Object.keys(filter).length > 0
      ? await ztsimulation.find(filter).lean()
      : await ztsimulation.find().lean();

    // Si no se encuentra ninguna simulación, lanzar error
    if (simulation.length === 0) {
     return{
        message: "No se encontraron simulaciones",
        data: []
      };
     
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
      REGUSER: idUser
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
const updateSimulationName = async (idSimulation, newName, idUser) => {
  try {
    // 1. Buscar la simulación a actualizar
    const simulacion = await ztsimulation.findOne({ SIMULATIONID: idSimulation }).lean();
    if (!simulacion) {
      throw {
        code: 400,
        message: `No se encontró simulación con SIMULATIONID: ${idSimulation}`,
        error: "SIMULATION_NOT_FOUND"
      };
    }

    // 2. Preparar el objeto de actualización
    const updateObject = {
      SIMULATIONNAME: newName
    };

    // 3. Crear nuevo registro para el historial
    const newRegistry = {
      CURRENT: true,
      REGDATE: new Date(),
      REGTIME: new Date().toTimeString().split(' ')[0],
      REGUSER: idUser || 'system'
    };

    // 4. Actualizar el historial DETAIL_ROW_REG
    updateObject.DETAIL_ROW = {
      ACTIVED: simulacion.DETAIL_ROW?.ACTIVED ?? true,
      DELETED: simulacion.DETAIL_ROW?.DELETED ?? false,
      DETAIL_ROW_REG: [
        ...(simulacion.DETAIL_ROW?.DETAIL_ROW_REG
          ?.filter(reg => typeof reg === 'object' && reg !== null)
          ?.map(reg => ({ ...reg, CURRENT: false })) || []),
        newRegistry
      ]
    };

    // 5. Realizar el update
    const updatedSimulation = await ztsimulation.findOneAndUpdate(
      { SIMULATIONID: idSimulation },
      { $set: updateObject },
      { new: true, lean: true }
    );

    if (!updatedSimulation) {
      throw {
        code: 400,
        message: "No se pudo actualizar la simulación",
        error: "UPDATE_FAILED"
      };
    }

    return {
      message: "Simulación actualizada exitosamente",
      success: true,
      simulation: updatedSimulation
    };
  } catch (error) {
    throw error;
  }
};

const updateSimulationName = async (id, simulationName, idUser) => {
    try {
        // 1. Buscar la simulación SIN .lean()
        const simulationToUpdate = await ztsimulation.findOne({ SIMULATIONID: id });
        if (!simulationToUpdate) {
            throw {
                code: 400,
                message: `No se encontró simulación con SIMULATIONID: ${id}`,
                error: "SIMULATION_NOT_FOUND"
            };
        }

        // 2. Clonar y actualizar los registros anteriores
        let registrosViejos = [];
        if (Array.isArray(simulationToUpdate.DETAIL_ROW?.DETAIL_ROW_REG)) {
            registrosViejos = simulationToUpdate.DETAIL_ROW.DETAIL_ROW_REG.map(reg => {
                // Clona el objeto y fuerza CURRENT a false
                return { ...reg, CURRENT: false };
            });
        }

        // 3. Crear nuevo registro para el historial
        const newRegistry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date().toTimeString().split(' ')[0],
            REGUSER: idUser || 'system'
        };

        // 4. Preparar el objeto de actualización SOLO con los campos necesarios
        const updateObject = {
            SIMULATIONNAME: simulationName,
            "DETAIL_ROW.ACTIVED": simulationToUpdate.DETAIL_ROW?.ACTIVED ?? true,
            "DETAIL_ROW.DELETED": simulationToUpdate.DETAIL_ROW?.DELETED ?? false,
            "DETAIL_ROW.DETAIL_ROW_REG": [
                ...registrosViejos,
                newRegistry
            ]
        };

        // 5. Realizar el update
        const updatedSimulation = await ztsimulation.findOneAndUpdate(
            { SIMULATIONID: id },
            { $set: updateObject },
            { new: true }
        );

        if (!updatedSimulation) {
            throw {
                code: 400,
                message: "No se pudo actualizar la simulación",
                error: "UPDATE_FAILED"
            };
        }

        return {
            message: "Simulación actualizada exitosamente",
            success: true,
            simulation: updatedSimulation
        };
    } catch (error) {
        throw error;
    }
}

module.exports = {
  updateSimulationName,
  deleteSimulation,
  getAllSimulaciones
};
