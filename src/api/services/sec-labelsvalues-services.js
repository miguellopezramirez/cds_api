const ztlabels = require('../models/mongodb/ztlabels')
const ztvalues = require('../models/mongodb/ztvalues')
const ztroles = require('../models/mongodb/ztroles')

async function GetAllLabelsValues(req) {
    try {
        const query = req.req.query;
        const type = query?.type;

        if (type === 'label') {
            const labelId = query.id;
            if (labelId) {
                return await getLabelById(labelId);
            } else {
                return await getAllLabels();
            }

        } else if (type === 'value') {
            const valueId = query.id;
            const labelId = query.labelid;

            if (valueId) {
                return await getValueById(valueId);
            } else if (labelId) {
                return await getValuesByLabel(labelId);
            } else {
                return await getAllValues();
            }

        } else {
            throw ({code: 400, message:"Parámetro 'type' no válido. Usa 'label' o 'value'." });
        }
    } catch (error) {
        throw error;
    }
}


// LABELS
async function getAllLabels() {
    return await ztlabels.find({}).lean();
}

async function getLabelById(labelId) {
    return await ztlabels.findOne({ LABELID: labelId }).lean();
}

// VALUES
async function getAllValues() {
    return await ztvalues.find({}).lean();
}

async function getValueById(valueId) {
    return await ztvalues.findOne({ VALUEID: valueId }).lean();
}

async function getValuesByLabel(labelId) {
    return await ztvalues.find({ LABELID: labelId }).lean();
}


// Patch de labels y values
// Patch para labels y values
async function UpdateLabelsValues(req) {
    const type = parseInt(req.req.query?.type);
    const id = req.req.query?.id;
    

    if (!id) {
        return { message: "Se requiere el parámetro 'id' para actualizar." };
    }

    if (type == 1) {
        const updateData = req.req.body.label;
        return patchLabels(req, id, updateData);
    } else if (type == 2) {
        const updateData = req.req.body.value;
        return patchValues(req, id, updateData);
    } else {
        return { message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." };
    }
}

//POST
async function PostLabelsValues(req) {
    const type = parseInt(req.data.type);  // Usar req.data para acceder al cuerpo de la solicitud

    if (type === 1) {
        const labelData = req.data.label;
        if (!labelData || !labelData.LABELID) {
            return { message: "Se requiere un objeto 'label' con un LABELID." };
        }

        const existingLabel = await ztlabels.findOne({ LABELID: labelData.LABELID }).lean();
        if (existingLabel) {
            return { message: `Ya existe un label con LABELID: ${labelData.LABELID}` };
        }

        const newLabel = new ztlabels(labelData);
        await newLabel.save();
        return { success: true, message: "Label creado exitosamente" };

    } else if (type === 2) {
        const valueData = req.data.value;
        if (!valueData || !valueData.VALUEID || !valueData.LABELID) {
            return { message: "Se requiere un objeto 'value' con VALUEID y LABELID." };
        }

        // ✅ Verificar que exista el LABELID antes de crear el value
        const labelExists = await ztlabels.findOne({ LABELID: valueData.LABELID }).lean();
        if (!labelExists) {
            return { message: `No existe un label con LABELID: ${valueData.LABELID}` };
        }

        const existingValue = await ztvalues.findOne({ VALUEID: valueData.VALUEID }).lean();
        if (existingValue) {
            return { message: `Ya existe un value con VALUEID: ${valueData.VALUEID}` };
        }

        const newValue = new ztvalues(valueData);
        await newValue.save();
        return { success: true, message: "Value creado exitosamente" };

    } else {
        return { message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." };
    }
}



// Actualización de Labels
async function patchLabels(req, id, updateData) {
    try {
        // 1. Verificar si existe el label
        const existingLabel = await ztlabels.findOne({ LABELID: id }).lean();
        if (!existingLabel) {
            return { message: `No se encontró label con LABELID: ${id}` };
        }

        // 2. Validar cambio de LABELID (si se está intentando modificar)
        if (updateData.LABELID && updateData.LABELID !== id) {
            // Verificar si el nuevo LABELID ya existe
            const labelWithNewId = await ztlabels.findOne({ 
                LABELID: updateData.LABELID 
            }).lean();
            
            if (labelWithNewId) {
                return { 
                    message: "Ya existe un label con el nuevo LABELID especificado",
                    conflict: {
                        existingLabel: labelWithNewId.LABELID,
                        attemptedNewId: updateData.LABELID
                    }
                };
            }

            // Si no existe, permitir el cambio (se actualizará abajo)
        }

        // 3. Realizar la actualización
        const updatedLabel = await ztlabels.findOneAndUpdate(
            { LABELID: id },
            { $set: updateData },
            { new: true, lean: true }
        );

        return {
            message: "Label actualizado exitosamente",
            success: true,
            // updatedLabel: updatedLabel
        };
    } catch (error) {
        throw error;
    }
}

// Actualización de Values
async function patchValues(req, id, updateData) {
    try {
        // 1. Encontrar el value que se quiere actualizar
        const valueToUpdate = await ztvalues.findOne({ VALUEID: id }).lean();
        if (!valueToUpdate) {
            return { message: `No se encontró value con VALUEID: ${id}` };
        }

        // 2. Validar que no se modifique LABELID o VALUEPAID
        if (updateData.LABELID && updateData.LABELID !== valueToUpdate.LABELID) {
            return { message: "No se puede modificar el LABELID de un value existente" };
        }

        if (updateData.VALUEPAID && updateData.VALUEPAID !== valueToUpdate.VALUEPAID) {
            return { message: "No se puede modificar el VALUEPAID de un value existente" };
        }
        

        // 3. Validar que si se modifica el VALUEID, el nuevo no exista ya
        if (updateData.VALUEID && updateData.VALUEID !== id) {
                // 4. Validar que no tenga valores dependientes
            const valor = await valideLabelid(valueToUpdate, "modificar");
            if (valor !== "" ) { // o simplemente if (valor != null)
                return valor;
            }
            const existingValue = await ztvalues.findOne({ VALUEID: updateData.VALUEID }).lean();
            if (existingValue) {
                return { message: `El VALUEID ${updateData.VALUEID} ya está en uso` };
            }
        }
        
        // 5. Si pasa todas las validaciones, proceder con la actualización
        const updatedValue = await ztvalues.findOneAndUpdate(
            { VALUEID: id },
            { $set: updateData },
            { new: true, lean: true }
        );
        
        return { 
            message: "Value actualizado exitosamente",
            success: true,
            // updatedValue: updatedValue 
        };
    } catch (error) {
        throw error;
    }
}

// Delete de labels y values
async function DeleteLabelsValues(req) {
    const type = parseInt(req.req.query?.type); 
    const id = req.req.query?.id;

    if (!id) {
        return { message: "Se requiere el parámetro 'id' para borrar." };
    }

    if (type == 1) {
        return deleteLabels(req, id);
    } else if (type == 2) {
        return deleteValues(req, id);
    } else {
        return { message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." };
    }
}
// Borrado de Labels
async function deleteLabels(req, id) {
    try {
        const labelToDelete = await ztlabels.findOne({ LABELID: id }).lean();
        if (!labelToDelete) {
            return { message: `No se encontró label con idlabel: ${id}` };
        }
        
        await ztlabels.deleteOne({ LABELID: id });
        return { 
            message: "Label borrado fisicamente exitosamente",
            deletedLabel: labelToDelete 
        };
    } catch (error) {
        throw error;
    }
}

//Borrado de Values
async function deleteValues(req, id) {
    try {
        // 1. Encontrar el value que se quiere borrar
        const valueToDelete = await ztvalues.findOne({ VALUEID: id }).lean();
        if (!valueToDelete) {
            return { message: `No se encontró value con VALUEID: ${id}` };
        }

        // 2. Validar que no tenga valores dependientes
        const valor = await valideLabelid(valueToDelete, "borrar");
        if (valor !== "") { // o simplemente if (valor != null)
            return valor;
        }

        // 3. Si no tiene hijos, proceder con el borrado
        await ztvalues.deleteOne({ VALUEID: id });
        
        return { 
            message: "Value borrado fisicamente exitosamente",
            deletedValue: valueToDelete 
        };
    } catch (error) {
        throw error;
    }
}

async function valideLabelid(valueToDelete, mensaje) {
    // 2. Validar si tiene hijos
    let children = [];

    // Caso especial para LABELID = "IdApplications", "IdViews"
    if (["IdApplications", "IdViews"].includes(valueToDelete.LABELID)) {
        const appName = valueToDelete.VALUEID;
        children = await ztvalues.find({ 
            VALUEPAID: { $regex: new RegExp(`${valueToDelete.LABELID}-${appName}`) } 
        }).lean();
        // Si tiene hijos no se puede borrar
        if (children.length > 0) {
            return { 
                message: `No se puede ${mensaje} porque tiene valores hijos asociados`,
                parentValue: valueToDelete,
                childValues: children 
            };
        }
    } 

    

    if (["IdProcesses", "IdPrivileges"].includes(valueToDelete.LABELID)) {
        let rolesUsingValue = [];
        
        if (valueToDelete.LABELID === "IdProcesses") {
            // Buscar en PROCESSID de ztroles
            const processPattern = `IdProcesses-${valueToDelete.VALUEID}`;
            rolesUsingValue = await ztroles.find({
                "PRIVILEGES.PROCESSID": { 
                    $regex: new RegExp(`^${processPattern}$`), 
                    $options: 'i' 
                }
            }).lean();
        } 
        else if (valueToDelete.LABELID === "IdPrivileges") {
            // Buscar en PRIVILEGEID de ztroles
            rolesUsingValue = await ztroles.find({
                "PRIVILEGES.PRIVILEGEID": valueToDelete.VALUEID
            }).lean();
        }

        if (rolesUsingValue.length > 0) {
            return { 
                message: `No se puede ${mensaje} porque está siendo usado por ${rolesUsingValue.length} rol(es)`,
                parentValue: valueToDelete,
                rolesUsingValue: rolesUsingValue.map(r => r.ROLEID)
            };
        }
    }
    return "";
}


module.exports = { GetAllLabelsValues, DeleteLabelsValues, UpdateLabelsValues, PostLabelsValues }