const ztlabels = require('../models/mongodb/ztlabels')
const ztvalues = require('../models/mongodb/ztvalues')
const ztroles = require('../models/mongodb/ztroles');
const { date } = require('@sap/cds/lib/core/classes');

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
    try{
        const type = parseInt(req.req.query?.type);
        const id = req.req.query?.id;
        

        if (!id) {
            throw {code:400, message: "Se requiere el parámetro 'id' para actualizar." };
        }

        if (type == 1) {
            const updateData = req.req.body.label;
            return patchLabels(req, id, updateData);
        } else if (type == 2) {
            const updateData = req.req.body.value;
            return patchValues(req, id, updateData);
        } else {
            return {code:400, message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." };
        }
    }catch(error){
        throw error;
    }
}

//POST
async function PostLabelsValues(req) {
    try {
        const type = parseInt(req.data.type);

        if (type === 1) {
            const labelData = req.data.label;
            if (!labelData) {
                throw { code: 400, message: "Se requiere un objeto o array 'label' en la solicitud" };
            }

            const labelsToProcess = Array.isArray(labelData) ? labelData : [labelData];
            const errors = [];

            // Validación previa de todos los elementos
            for (const labelItem of labelsToProcess) {
                if (!labelItem.LABELID || !labelItem.REGUSER) {
                    errors.push(`Label sin campos obligatorios (LABELID o REGUSER): ${JSON.stringify(labelItem)} `);
                    continue;
                }

                const existingLabel = await ztlabels.findOne({ LABELID: labelItem.LABELID }).lean();
                if (existingLabel) {
                    errors.push(`Ya existe un label con LABELID: ${labelItem.LABELID} `);
                }
            }

            if (errors.length > 0) {
                throw {
                    code: 422,
                    message: "Errores al validar los labels: " + errors,
                }
            }

            // Inserción solo si todo está validado
            const results = [];
            for (const labelItem of labelsToProcess) {
                const newLabel = {
                    LABELID: labelItem.LABELID,
                    COMPANYID: labelItem.COMPANYID,
                    CEDIID: labelItem.CEDIID,
                    LABEL: labelItem.LABEL,
                    INDEX: labelItem.INDEX,
                    COLLECTION: labelItem.COLLECTION,
                    SECTION: labelItem.SECTION,
                    SEQUENCE: labelItem.SEQUENCE,
                    IMAGE: labelItem.IMAGE,
                    DESCRIPTION: labelItem.DESCRIPTION,
                    DETAIL_ROW: {
                        ACTIVED: labelItem.ACTIVED !== undefined ? labelItem.ACTIVED : true,
                        DELETED: false,
                        DETAIL_ROW_REG: [{
                            CURRENT: true,
                            REGDATE: new Date(),
                            REGTIME: new Date(),
                            REGUSER: labelItem.REGUSER
                        }]
                    }
                };
                const savedLabel = new ztlabels(newLabel);
                await savedLabel.save();
                results.push({ success: true, label: newLabel });
            }

            return {
                message: "Labels insertados correctamente",
                successCount: results.length,
                results
            };

        } else if (type === 2) {
            const valueData = req.data.value;
            if (!valueData) {
                throw { code: 400, message: "Se requiere un objeto o array 'value' en la solicitud" };
            }

            const valuesToProcess = Array.isArray(valueData) ? valueData : [valueData];
            const errors = [];

            // Validación previa
            for (const valueItem of valuesToProcess) {
                if (!valueItem.VALUEID || !valueItem.LABELID || !valueItem.REGUSER) {
                    errors.push(`Value sin campos obligatorios (VALUEID, LABELID o REGUSER): ${JSON.stringify(valueItem)} `);
                    continue;
                }

                const labelExists = await ztlabels.findOne({ LABELID: valueItem.LABELID }).lean();
                if (!labelExists) {
                    errors.push(`No existe un label con LABELID: ${valueItem.LABELID} para el value ${valueItem.VALUEID} `);
                }

                const existingValue = await ztvalues.findOne({ VALUEID: valueItem.VALUEID }).lean();
                if (existingValue) {
                    errors.push(`Ya existe un value con VALUEID: ${valueItem.VALUEID} `);
                }
            }

            if (errors.length > 0) {
                throw {
                    code: 422,
                    message: "Errores al validar los values: " + errors,
                    errors
                };
            }

            const results = [];
            for (const valueItem of valuesToProcess) {
                const newValue = {
                    VALUEID: valueItem.VALUEID,
                    COMPANYID: valueItem.COMPANYID,
                    CEDIID: valueItem.CEDIID,
                    LABELID: valueItem.LABELID,
                    VALUEPAID: valueItem.VALUEPAID,
                    VALUE: valueItem.VALUE,
                    ALIAS: valueItem.ALIAS,
                    SEQUENCE: valueItem.SEQUENCE,
                    IMAGE: valueItem.IMAGE,
                    DESCRIPTION: valueItem.DESCRIPTION,
                    DETAIL_ROW: {
                        ACTIVED: valueItem.ACTIVED !== undefined ? valueItem.ACTIVED : true,
                        DELETED: false,
                        DETAIL_ROW_REG: [{
                            CURRENT: true,
                            REGDATE: new Date(),
                            REGTIME: new Date(),
                            REGUSER: valueItem.REGUSER
                        }]
                    }
                };

                const savedValue = new ztvalues(newValue);
                await savedValue.save();
                results.push({ success: true, value: newValue });
            }

            return {
                message: "Values insertados correctamente",
                successCount: results.length,
                results
            };

        } else {
            throw ({ code: 400, message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." });
        }

    } catch (error) {
        // Normaliza error
        throw error;
    }
}



// Actualización de Labels
async function patchLabels(req, id, updateData) {
    try {
        // 1. Verificar si existe el label
        const existingLabel = await ztlabels.findOne({ LABELID: id }).lean();
        if (!existingLabel) {
            throw ({code: 400, message: `No se encontró label con LABELID: ${id}` })
        }

        // 2. Validar cambio de LABELID (si se está intentando modificar)
        if (updateData.LABELID && updateData.LABELID !== id) {
            const labelWithNewId = await ztlabels.findOne({ 
                LABELID: updateData.LABELID 
            }).lean();
            
            if (labelWithNewId) {
                throw ({
                    code: 400,
                    message: "Ya existe un label con el nuevo LABELID especificado",
                    conflict: {
                        existingLabel: labelWithNewId.LABELID,
                        attemptedNewId: updateData.LABELID
                    }
                })
            }
        }

        // 3. Preparar la actualización del DETAIL_ROW si viene en los datos
        const updateObject = { ...updateData };
        
        // 5. Handle DETAIL_ROW update
        if (updateData.ACTIVED) {
            // First, mark all current registries as not current
            await ztlabels.updateOne(
                { VALUEID: id, "DETAIL_ROW.DETAIL_ROW_REG.CURRENT": true },
                { $set: { "DETAIL_ROW.DETAIL_ROW_REG.$[elem].CURRENT": false } },
                { arrayFilters: [{ "elem.CURRENT": true }] }
            );
        }

                // 5. Create new registry entry
        const newRegistry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: updateData?.REGUSER || 'system'
        };

        // Get the updated document to include the modified registries

        updateObject.DETAIL_ROW = {
            ACTIVED: updateData.ACTIVED ?? existingLabel.DETAIL_ROW?.ACTIVED ?? true,
            DELETED: existingLabel.DETAIL_ROW?.DELETED ?? false,
            DETAIL_ROW_REG: [
                ...(
                existingLabel.DETAIL_ROW?.DETAIL_ROW_REG
                    ?.filter(reg => typeof reg === 'object' && reg !== null)
                    ?.map(reg => ({ ...reg, CURRENT: false })) || []
                ),
                newRegistry
            ]
        };

        // 4. Realizar la actualización
        const updatedLabel = await ztlabels.findOneAndUpdate(
            { LABELID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );

        return {
            message: "Label actualizado exitosamente",
            success: true,
            value: updatedLabel
        };

    } catch (error) {
        throw error;
    }
}

async function patchValues(req, id, updateData) {
    try {
        // 1. Find the value to update
        const valueToUpdate = await ztvalues.findOne({ VALUEID: id }).lean();
        if (!valueToUpdate) {
            throw {
                code: 400,
                message: `No se encontró value con VALUEID: ${id}`,
                error: "VALUE_NOT_FOUND"
            };
        }

        // 2. Prevent LABELID changes
        if (updateData.LABELID && updateData.LABELID !== valueToUpdate.LABELID) {
            throw { 
                code: 400,
                message: "No está permitido modificar el LABELID de un value existente",
                error: "LABELID_MODIFICATION_NOT_ALLOWED"
            };
        }

        // 3. Prevent VALUEID changes
        if (updateData.VALUEID && updateData.VALUEID !== id) {
            throw { 
                code: 400,
                message: "No está permitido modificar el VALUEID de un value existente",
                error: "VALUEID_MODIFICATION_NOT_ALLOWED"
            };
        }

        // 4. Prepare update object
        const updateObject = { ...updateData };
    


        // 5. Create new registry entry
        const newRegistry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: updateData?.REGUSER || 'system'
        };

        // Get the updated document to include the modified registries

        updateObject.DETAIL_ROW = {
            ACTIVED: updateData.ACTIVED ?? valueToUpdate.DETAIL_ROW?.ACTIVED ?? true,
            DELETED: valueToUpdate.DETAIL_ROW?.DELETED ?? false,
            DETAIL_ROW_REG: [
                ...(
                valueToUpdate.DETAIL_ROW?.DETAIL_ROW_REG
                    ?.filter(reg => typeof reg === 'object' && reg !== null)
                    ?.map(reg => ({ ...reg, CURRENT: false })) || []
                ),
                newRegistry
            ]
        };
        

        // 6. Perform the update
        const updatedValue = await ztvalues.findOneAndUpdate(
            { VALUEID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );
        
        return { 
            message: "Value actualizado exitosamente",
            success: true,
            value: updatedValue
        };
    } catch (error) {
        throw error;
    }
}

// Delete de labels y values
async function DeleteLabelsValues(req) {
    try {
        const type = parseInt(req.req.query?.type);
        const id = req.req.query?.id;
        const mode = req.req.query?.mode?.toLowerCase(); // 'logical' o 'physical'
        const reguser = req.req.query?.reguser;

        if (!id) {
            throw { code: 400, message: "Se requiere el parámetro 'id' para borrar." };
        }

        if (!['logical', 'physical'].includes(mode)) {
            throw { code: 400, message: "Parámetro 'mode' no válido. Usa 'logical' o 'physical'." };
        }

        if (!reguser && mode === 'logical') {
            throw { code: 400, message: "Para el borrado lógico se requiere el parámetro 'reguser'." };
        }

        if (type === 1) {
            return await deleteLabel(id, mode, reguser);
        } else if (type === 2) {
            return await deleteValue(id, mode, reguser);
        } else {
            throw { code: 400, message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." };
        }

    } catch (error) {
        throw error;
    }
}

// 🔴 Borrado de Labels
async function deleteLabel(id, mode, reguser) {
    try {
        const label = await ztlabels.findOne({ LABELID: id }).lean();
        if (!label) {
            throw { code: 404, message: `No se encontró label con LABELID: ${id}` };
        }

        if (mode === 'physical') {
            await ztlabels.deleteOne({ LABELID: id });
            return {
                code: 200,
                message: "Label borrado físicamente exitosamente",
                deletedLabel: label
            };
        }

        // Borrado lógico
        const newRegistry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: reguser
        };

        const updateObject = {
            DETAIL_ROW: {
                ACTIVED: false,
                DELETED: true,
                DETAIL_ROW_REG: [
                    ...(label.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false })) || []),
                    newRegistry
                ]
            }
        };

        const updatedLabel = await ztlabels.findOneAndUpdate(
            { LABELID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );

        return {
            code: 200,
            message: "Label borrado lógicamente exitosamente",
            updatedLabel
        };

    } catch (error) {
        throw { code: 500, message: `Error al borrar label: ${error.message}` };
    }
}

// 🔵 Borrado de Values
async function deleteValue(id, mode, reguser) {
    try {
        const value = await ztvalues.findOne({ VALUEID: id }).lean();
        if (!value) {
            throw { code: 404, message: `No se encontró value con VALUEID: ${id}` };
        }

        if (mode === 'physical') {
            await ztvalues.deleteOne({ VALUEID: id });
            return {
                code: 200,
                message: "Value borrado físicamente exitosamente",
                deletedValue: value
            };
        }

        // Borrado lógico
        const newRegistry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: reguser
        };

        const updateObject = {
            DETAIL_ROW: {
                ACTIVED: false,
                DELETED: true,
                DETAIL_ROW_REG: [
                    ...(value.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false })) || []),
                    newRegistry
                ]
            }
        };

        const updatedValue = await ztvalues.findOneAndUpdate(
            { VALUEID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );

        return {
            code: 200,
            message: "Value borrado lógicamente exitosamente",
            updatedValue
        };

    } catch (error) {
        throw error ;
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