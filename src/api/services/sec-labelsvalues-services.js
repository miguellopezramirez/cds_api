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



//POST
async function PostLabelsValues(req) {
    const type = parseInt(req.req.query?.type);
    
    if (![1, 2].includes(type)) {
        return {
            code: 400,
            status: "invalid_type",
            message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values.",
            successCount: 0,
            errorCount: 0,
            items: []
        };
    }

    try {
        if (type === 1) {
            return await processLabels(req.data);
        } else {
            return await processValues(req.data);
        }
    } catch (error) {
        // Si el error ya tiene la estructura de respuesta que queremos, lo retornamos directamente
        if (error.items && error.successCount !== undefined) {
            return error;
        }
        
        // Para errores inesperados
        return {
            code: 500,
            status: "server_error",
            message: "Error interno del servidor: " + (error.message || error.toString()),
            successCount: 0,
            errorCount: 0,
            items: []
        };
    }
}

async function processLabels(data) {
    const labelData = data.label;
    if (!labelData) {
        return {
            code: 400,
            status: "missing_label_data",
            message: "Se requiere un objeto o array 'label' en la solicitud",
            successCount: 0,
            errorCount: 0,
            items: []
        };
    }

    const labelsToProcess = Array.isArray(labelData) ? labelData : [labelData];
    const results = [];

    for (const [index, labelItem] of labelsToProcess.entries()) {
        const itemResult = {
            position: index + 1,
            LABELID: labelItem.LABELID,
            status: "pending",
            saved: false,
            error: null,
            details: null,
            message: ""
        };

        try {
            // Validación básica
            if (!labelItem.LABELID || !labelItem.REGUSER) {
                throw { 
                    message: "Label sin campos obligatorios (LABELID o REGUSER)",
                    status: "missing_required_fields"
                };
            }

            // Validar unicidad
            const existingLabel = await ztlabels.findOne({ LABELID: labelItem.LABELID }).lean();
            if (existingLabel) {
                throw { 
                    message: `Ya existe un label con LABELID: ${labelItem.LABELID}`,
                    status: "duplicate_labelid"
                };
            }

            // Construir el nuevo label
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

            // Intentar inserción
            const savedLabel = new ztlabels(newLabel);
            await savedLabel.save();
            
            itemResult.status = "success";
            itemResult.saved = true;
            itemResult.details = newLabel;
            itemResult.message = "Label insertado correctamente";

        } catch (error) {
            itemResult.status = error.status || "insert_error";
            itemResult.error = error.message || error;
            itemResult.message = `Error al insertar label: ${error.message}`;
        }

        results.push(itemResult);
    }

    // Calcular estadísticas
    const successCount = results.filter(r => r.saved).length;
    const errorCount = results.length - successCount;

    // Determinar código de respuesta
    let code = 200;
    if (successCount === 0) code = 422;
    else if (errorCount > 0) code = 207;

    return {
        code,
        status: successCount > 0 
            ? (errorCount > 0 ? "partial_success" : "complete_success") 
            : "complete_error",
        totalItems: results.length,
        successCount,
        errorCount,
        items: results,
        message: successCount > 0 
            ? (errorCount > 0 
                ? 'Algunos labels se insertaron con errores' 
                : 'Todos los labels se insertaron correctamente')
            : 'Ningún label pudo ser insertado'
    };
}

async function processValues(data) {
    const valueData = data.value;
    if (!valueData) {
        return {
            code: 400,
            status: "missing_value_data",
            message: "Se requiere un objeto o array 'value' en la solicitud",
            successCount: 0,
            errorCount: 0,
            items: []
        };
    }

    const valuesToProcess = Array.isArray(valueData) ? valueData : [valueData];
    const results = [];

    for (const [index, valueItem] of valuesToProcess.entries()) {
        const itemResult = {
            position: index + 1,
            VALUEID: valueItem.VALUEID,
            LABELID: valueItem.LABELID,
            status: "pending",
            saved: false,
            error: null,
            details: null,
            message: ""
        };

        try {
            // Validación básica
            if (!valueItem.VALUEID || !valueItem.LABELID || !valueItem.REGUSER) {
                throw { 
                    message: "Value sin campos obligatorios (VALUEID, LABELID o REGUSER)",
                    status: "missing_required_fields"
                };
            }

            // Validar existencia del label
            const labelExists = await ztlabels.findOne({ LABELID: valueItem.LABELID }).lean();
            if (!labelExists) {
                throw { 
                    message: `No existe un label con LABELID: ${valueItem.LABELID}`,
                    status: "label_not_found"
                };
            }

            // Validar unicidad del value
            const existingValue = await ztvalues.findOne({ VALUEID: valueItem.VALUEID }).lean();
            if (existingValue) {
                throw { 
                    message: `Ya existe un value con VALUEID: ${valueItem.VALUEID}`,
                    status: "duplicate_valueid"
                };
            }

            // Construir el nuevo value
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

            // Intentar inserción
            const savedValue = new ztvalues(newValue);
            await savedValue.save();
            
            itemResult.status = "success";
            itemResult.saved = true;
            itemResult.details = newValue;
            itemResult.message = "Value insertado correctamente";

        } catch (error) {
            itemResult.status = error.status || "insert_error";
            itemResult.error = error.message || error;
            itemResult.message = `Error al insertar value: ${error.message}`;
        }

        results.push(itemResult);
    }

    // Calcular estadísticas
    const successCount = results.filter(r => r.saved).length;
    const errorCount = results.length - successCount;

    // Determinar código de respuesta
    let code = 200;
    if (successCount === 0) code = 422;
    else if (errorCount > 0) code = 207;

    return {
        code,
        status: successCount > 0 
            ? (errorCount > 0 ? "partial_success" : "complete_success") 
            : "complete_error",
        totalItems: results.length,
        successCount,
        errorCount,
        items: results,
        message: successCount > 0 
            ? (errorCount > 0 
                ? 'Algunos values se insertaron con errores' 
                : 'Todos los values se insertaron correctamente')
            : 'Ningún value pudo ser insertado'
    };
}

// Patch para labels y values con soporte para múltiples actualizaciones
async function UpdateLabelsValues(req) {
    try {
        const type = parseInt(req.req.query?.type);

        if (type == 1) {
            const updateData = req.req.body.labels;
            if (!Array.isArray(updateData)) {
                return { 
                    status: "error",
                    totalItems: 0,
                    successCount: 0,
                    errorCount: 0,
                    items: [],
                    message: "Para actualización de labels, se espera un array en el cuerpo de la petición" 
                };
            }
            return patchLabels(req, updateData);
        } else if (type == 2) {
            const updateData = req.req.body.values;
            if (!Array.isArray(updateData)) {
                return { 
                    status: "error",
                    totalItems: 0,
                    successCount: 0,
                    errorCount: 0,
                    items: [],
                    message: "Para actualización de values, se espera un array en el cuerpo de la petición" 
                };
            }
            return patchValues(req, updateData);
        } else {
            return { 
                status: "error",
                totalItems: 0,
                successCount: 0,
                errorCount: 0,
                items: [],
                message: "Parámetro 'type' no válido. Usa 1 para labels o 2 para values." 
            };
        }
    } catch (error) {
        throw error;
    }
}

// Actualización múltiple de Labels
async function patchLabels(req, updateDataArray) {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updateDataArray.length; i++) {
        const updateData = updateDataArray[i];
        const position = i + 1;
        const itemResult = {
            position,
            LABELID: updateData.LABELID || null,
            status: "pending",
            saved: false,
            error: null,
            details: null,
            message: ""
        };

        try {
            // 1. Verificar si existe el LABELID en los datos
            if (!updateData.LABELID) {
                itemResult.status = "missing_labelid";
                itemResult.saved = false;
                itemResult.error = "Falta el campo obligatorio LABELID";
                itemResult.message = "Error al actualizar label: Falta el campo obligatorio LABELID";
                errorCount++;
                results.push(itemResult);
                continue;
            }

            // 2. Verificar si existe el label en la base de datos
            const existingLabel = await ztlabels.findOne({ LABELID: updateData.LABELID }).lean();
            if (!existingLabel) {
                itemResult.status = "label_not_found";
                itemResult.saved = false;
                itemResult.error = `No se encontró label con LABELID: ${updateData.LABELID}`;
                itemResult.message = `Error al actualizar label: No se encontró label con LABELID: ${updateData.LABELID}`;
                errorCount++;
                results.push(itemResult);
                continue;
            }

            // 3. Preparar la actualización
            const updateObject = { ...updateData };
            
            // 4. Manejar actualización de DETAIL_ROW si viene ACTIVED en los datos
            if (updateData.ACTIVED !== undefined) {
                await ztlabels.updateOne(
                    { LABELID: updateData.LABELID, "DETAIL_ROW.DETAIL_ROW_REG.CURRENT": true },
                    { $set: { "DETAIL_ROW.DETAIL_ROW_REG.$[elem].CURRENT": false } },
                    { arrayFilters: [{ "elem.CURRENT": true }] }
                );
            }

            // 5. Crear nuevo registro
            const newRegistry = {
                CURRENT: true,
                REGDATE: new Date(),
                REGTIME: new Date(),
                REGUSER: updateData?.REGUSER || 'system'
            };

            updateObject.DETAIL_ROW = {
                ACTIVED: updateData.ACTIVED ?? existingLabel.DETAIL_ROW?.ACTIVED ?? true,
                DELETED: existingLabel.DETAIL_ROW?.DELETED ?? false,
                DETAIL_ROW_REG: [
                    ...(existingLabel.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false }))) || [],
                    newRegistry
                ]
            };

            // 6. Realizar la actualización
            const updatedLabel = await ztlabels.findOneAndUpdate(
                { LABELID: updateData.LABELID },
                { $set: updateObject },
                { new: true, lean: true }
            );

            itemResult.status = "success";
            itemResult.saved = true;
            itemResult.details = updatedLabel;
            itemResult.message = "Label actualizado correctamente";
            successCount++;
            results.push(itemResult);

        } catch (error) {
            itemResult.status = "error";
            itemResult.saved = false;
            itemResult.error = error.message || "Error desconocido al actualizar el label";
            itemResult.message = `Error al actualizar label: ${error.message || "Error desconocido"}`;
            errorCount++;
            results.push(itemResult);
        }
    }

    const finalStatus = 
        errorCount === 0 ? "success" : 
        successCount === 0 ? "error" : "partial_success";

    return {
        status: finalStatus,
        totalItems: updateDataArray.length,
        successCount,
        errorCount,
        items: results,
        message: 
            finalStatus === "success" ? "Todos los labels se actualizaron correctamente" :
            finalStatus === "error" ? "Ningún label se pudo actualizar" :
            "Algunos labels se actualizaron con errores"
    };
}

// Actualización múltiple de Values
async function patchValues(req, updateDataArray) {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updateDataArray.length; i++) {
        const updateData = updateDataArray[i];
        const position = i + 1;
        const itemResult = {
            position,
            VALUEID: updateData.VALUEID || null,
            LABELID: updateData.LABELID || null,
            status: "pending",
            saved: false,
            error: null,
            details: null,
            message: ""
        };

        try {
            // 1. Verificar si existe el VALUEID en los datos
            if (!updateData.VALUEID) {
                itemResult.status = "missing_valueid";
                itemResult.saved = false;
                itemResult.error = "Falta el campo obligatorio VALUEID";
                itemResult.message = "Error al actualizar value: Falta el campo obligatorio VALUEID";
                errorCount++;
                results.push(itemResult);
                continue;
            }

            // 2. Find the value to update
            const valueToUpdate = await ztvalues.findOne({ VALUEID: updateData.VALUEID }).lean();
            if (!valueToUpdate) {
                itemResult.status = "value_not_found";
                itemResult.saved = false;
                itemResult.error = `No se encontró value con VALUEID: ${updateData.VALUEID}`;
                itemResult.message = `Error al actualizar value: No se encontró value con VALUEID: ${updateData.VALUEID}`;
                errorCount++;
                results.push(itemResult);
                continue;
            }

            // 3. Set LABELID in response from existing value if not provided
            itemResult.LABELID = valueToUpdate.LABELID;

            // 4. Prevent LABELID changes
            if (updateData.LABELID && updateData.LABELID !== valueToUpdate.LABELID) {
                itemResult.status = "labelid_modification_not_allowed";
                itemResult.saved = false;
                itemResult.error = "No está permitido modificar el LABELID de un value existente";
                itemResult.message = "Error al actualizar value: No está permitido modificar el LABELID";
                errorCount++;
                results.push(itemResult);
                continue;
            }

            // 5. Prepare update object
            const updateObject = { ...updateData };
            
            // 6. Create new registry entry
            const newRegistry = {
                CURRENT: true,
                REGDATE: new Date(),
                REGTIME: new Date(),
                REGUSER: updateData?.REGUSER || 'system'
            };

            updateObject.DETAIL_ROW = {
                ACTIVED: updateData.ACTIVED ?? valueToUpdate.DETAIL_ROW?.ACTIVED ?? true,
                DELETED: valueToUpdate.DETAIL_ROW?.DELETED ?? false,
                DETAIL_ROW_REG: [
                    ...(valueToUpdate.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false })) || []),
                    newRegistry
                ]
            };

            // 7. Perform the update
            const updatedValue = await ztvalues.findOneAndUpdate(
                { VALUEID: updateData.VALUEID },
                { $set: updateObject },
                { new: true, lean: true }
            );
            
            itemResult.status = "success";
            itemResult.saved = true;
            itemResult.details = updatedValue;
            itemResult.message = "Value actualizado correctamente";
            successCount++;
            results.push(itemResult);

        } catch (error) {
            itemResult.status = "error";
            itemResult.saved = false;
            itemResult.error = error.message || "Error desconocido al actualizar el value";
            itemResult.message = `Error al actualizar value: ${error.message || "Error desconocido"}`;
            errorCount++;
            results.push(itemResult);
        }
    }

    const finalStatus = 
        errorCount === 0 ? "success" : 
        successCount === 0 ? "error" : "partial_success";

    return {
        status: finalStatus,
        totalItems: updateDataArray.length,
        successCount,
        errorCount,
        items: results,
        message: 
            finalStatus === "success" ? "Todos los values se actualizaron correctamente" :
            finalStatus === "error" ? "Ningún value se pudo actualizar" :
            "Algunos values se actualizaron con errores"
    };
}

// Actualización múltiple de Values
async function patchValues(req, updateDataArray) {
    try {
        const results = [];
        
        for (const updateData of updateDataArray) {
            try {
                // 1. Verificar si existe el VALUEID en los datos
                if (!updateData.VALUEID) {
                    results.push({
                        VALUEID: null,
                        success: false,
                        message: "Falta el campo obligatorio VALUEID"
                    });
                    continue;
                }

                // 2. Find the value to update
                const valueToUpdate = await ztvalues.findOne({ VALUEID: updateData.VALUEID }).lean();
                if (!valueToUpdate) {
                    results.push({
                        VALUEID: updateData.VALUEID,
                        success: false,
                        message: `No se encontró value con VALUEID: ${updateData.VALUEID}`
                    });
                    continue;
                }

                // 3. Prevent LABELID changes
                if (updateData.LABELID && updateData.LABELID !== valueToUpdate.LABELID) {
                    results.push({
                        VALUEID: updateData.VALUEID,
                        success: false,
                        message: "No está permitido modificar el LABELID de un value existente"
                    });
                    continue;
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
                    { VALUEID: updateData.VALUEID },
                    { $set: updateObject },
                    { new: true, lean: true }
                );
                
                results.push({
                    VALUEID: updateData.VALUEID,
                    success: true,
                    message: "Value actualizado exitosamente",
                    value: updatedValue
                });
            } catch (error) {
                results.push({
                    VALUEID: updateData.VALUEID,
                    success: false,
                    message: error.message || "Error al actualizar el value"
                });
            }
        }

        return {
            message: "Proceso de actualización de values completado",
            success: true,
            value: results
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