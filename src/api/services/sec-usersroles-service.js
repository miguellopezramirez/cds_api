const ztusers = require('../models/mongodb/ztusers')
const ztroles = require('../models/mongodb/ztroles')
const ztvalues = require('../models/mongodb/ztvalues')

async function PatchUser(req) {
    const { body } = req;

    const { id, data: updates = {} } = body;
    if (!id) throw new Error("Se requiere USERID");

    try {
        //Validar que el usuario exista
        const user = await ztusers.findOne({ USERID: id });
        if (!user || (user.DETAIL_ROW?.DELETED === true)) 
            throw new Error(`Usuario con USERID ${id} no encontrado`); //Es el mismo mensaje de error si el usuario fue eliminado lógica o físicamente, o si nunca existió. 
        
        //Si se modificará un rol, validar que el rol exista
        if (updates.ROLES) {
            await validateRolesExist(updates.ROLES);
        }
        
        updates.DETAIL_ROW = {
            ...user.DETAIL_ROW, 
            DELETED: false,
            ACTIVED: true
        };

        //Agregar registro de DETAIL_ROW
        updates.DETAIL_ROW.DETAIL_ROW_REG = updateAuditLog(
            user.DETAIL_ROW?.DETAIL_ROW_REG || [], 
            req.user?.id || 'aramis'
        );

        //Actualizar datos
        await ztusers.updateOne({ USERID: id }, { $set: updates });
        return { success: true, message: `El usuario ${id} ha sido modificado correctamente.` };;
    } catch (error) {
        console.error("Error al actualizar el usuario: ", error.message);
        throw error;
    }
}

// Update de usuarios y roles
async function PatchUserOrRole(req) {
    try {
        const type = req.req.query?.type?.toLowerCase(); // 'user' o 'role'
        const id = req.req.query?.id;
        const reguser = req.req.query?.reguser || 'system';
        const data = req.req.body;

        if (!type) {
            throw { code: 400, message: "Se requiere el parámetro 'type' (user o role)." };
        }

        if (!id) {
            throw { 
                code: 400, 
                message: `Se requiere el parámetro 'id' (${type === 'user' ? 'USERID' : 'ROLEID'})` 
            };
        }

        if (!data) {
            throw { code: 400, message: "Se requieren datos para actualizar en el body." };
        }

        if (type === 'user') {
            return await updateUser(id, data.user, reguser);
        } else if (type === 'role') {
            return await updateRole(id, data.role, reguser);
        } else {
            throw { code: 400, message: "Parámetro 'type' no válido. Usa 'user' o 'role'." };
        }

    } catch (error) {
        throw error;
    }
}

// 🔴 Actualización de Usuarios
async function updateUser(id, updates, reguser) {
    try {
        // Validar que el usuario exista
        const user = await ztusers.findOne({ USERID: id }).lean();
        if (!user) {
            throw { 
                code: 404, 
                message: `Usuario con USERID ${id} no encontrado` 
            };
        }

        // Si se modificará un rol, validar que el rol exista
        if (updates.ROLES) {
            await validateRolesExist(updates.ROLES);
        }
        
        // Preparar actualización de DETAIL_ROW
        updates.DETAIL_ROW = {
            ...user.DETAIL_ROW, 
            DELETED: false,
            ACTIVED: true,
            DETAIL_ROW_REG: updateAuditLog(
                user.DETAIL_ROW?.DETAIL_ROW_REG || [], 
                reguser
            )
        };

        // Actualizar datos
        await ztusers.updateOne({ USERID: id }, { $set: updates });
        
        return {
            code: 200,
            success: true,
            message: `Usuario ${id} actualizado correctamente`,
            updatedUser: { USERID: id, ...updates }
        };

    } catch (error) {
        throw { 
            code: error.code || 500, 
            message: `Error al actualizar usuario: ${error.message}` 
        };
    }
}

// 🔵 Actualización de Roles
async function updateRole(id, updates, reguser) {
    try {
        // Verificar que el rol exista
        const role = await ztroles.findOne({ ROLEID: id }).lean();
        if (!role) {
            throw { 
                code: 404, 
                message: `Rol con ROLEID ${id} no encontrado` 
            };
        }

        // Si se modifican procesos o privilegios validar que existan
        if (updates.PRIVILEGES) {
            await validatePrivilegesExist(updates.PRIVILEGES);
        }

        // Preparar actualización de DETAIL_ROW
        updates.DETAIL_ROW = {
            ...role.DETAIL_ROW,
            DELETED: false,
            ACTIVED: true,
            DETAIL_ROW_REG: updateAuditLog(
                role.DETAIL_ROW?.DETAIL_ROW_REG || [],
                reguser
            )
        };

        // Actualizar datos
        await ztroles.updateOne({ ROLEID: id }, { $set: updates });
        
        return {
            code: 200,
            success: true,
            message: `Rol ${id} actualizado correctamente`,
            updatedRole: { ROLEID: id, ...updates }
        };

    } catch (error) {
        throw { 
            code: error.code || 500, 
            message: `Error al actualizar rol: ${error.message}` 
        };
    }
}

// --- Funciones de Validación ---
async function validateRolesExist(roles) {
    const roleIds = roles.map(r => r.ROLEID);
    const existingRoles = await ztroles.countDocuments({ ROLEID: { $in: roleIds } });
    if (existingRoles !== roleIds.length) {
        throw new Error("Uno o más ROLES no existen");
    }
}

async function validatePrivilegesExist(privileges) {
    await Promise.all(privileges.map(async (priv) => {
        const processIdPart = priv.PROCESSID.split('-')[1];
        if (!processIdPart) {
            throw {
                code: 'INVALID_PROCESSID',
                message: `Formato inválido en PROCESSID: ${priv.PROCESSID}`
            };
        }

        const [processCheck, ...privilegeChecks] = await Promise.all([
            ztvalues.countDocuments({ LABELID: "IdProcesses", VALUEID: processIdPart }),
            ...priv.PRIVILEGEID.map(pid =>
                ztvalues.countDocuments({ LABELID: "IdPrivileges", VALUEID: pid })
            )
        ]);

        if (!processCheck) {
            throw {
                code: 'PROCESSID_NOT_FOUND',
                message: `PROCESSID '${processIdPart}' no existe`
            };
        }

        privilegeChecks.forEach((exists, i) => {
            if (!exists) {
                throw {
                    code: 'PRIVILEGEID_NOT_FOUND',
                    message: `PRIVILEGEID '${priv.PRIVILEGEID[i]}' no existe`
                };
            }
        });
    }));
}

// Función auxiliar para actualizar el registro de auditoría
function updateAuditLog(existingRegistries = [], reguser) {
    const newRegistry = {
        CURRENT: true,
        REGDATE: new Date(),
        REGTIME: new Date(),
        REGUSER: reguser
    };

    return [
        ...(existingRegistries
            .filter(reg => typeof reg === 'object' && reg !== null)
            .map(reg => ({ ...reg, CURRENT: false }))) || [],
        newRegistry
    ];
}

// Delete de usuarios y roles
async function DeleteUserOrRole(req) {
    try {
        const type = req.req.query?.type?.toLowerCase(); // 'user' o 'role'
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

        if (type === 'user') {
            return await deleteUser(id, mode, reguser);
        } else if (type === 'role') {
            return await deleteRole(id, mode, reguser);
        } else {
            throw { code: 400, message: "Parámetro 'type' no válido. Usa 'user' o 'role'." };
        }

    } catch (error) {
        throw error;
    }
}

// 🔴 Borrado de Usuarios
async function deleteUser(id, mode, reguser) {
    try {
        const user = await ztusers.findOne({ USERID: id }).lean();
        if (!user) {
            throw { code: 404, message: `No se encontró usuario con USERID: ${id}` };
        }

        if (mode === 'physical') {
            await ztusers.deleteOne({ USERID: id });
            return {
                code: 200,
                message: "Usuario borrado físicamente exitosamente",
                deletedUser: user
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
                    ...(user.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false })) || []),
                    newRegistry
                ]
            }
        };

        const updatedUser = await ztusers.findOneAndUpdate(
            { USERID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );

        return {
            code: 200,
            message: "Usuario borrado lógicamente exitosamente",
            updatedUser
        };

    } catch (error) {
        throw { code: 500, message: `Error al borrar usuario: ${error.message}` };
    }
}

// 🔵 Borrado de Roles
async function deleteRole(id, mode, reguser) {
    try {
        const role = await ztroles.findOne({ ROLEID: id }).lean();
        if (!role) {
            throw { code: 404, message: `No se encontró rol con ROLEID: ${id}` };
        }

        // Validar que el rol no esté en uso (solo para borrado físico)
        if (mode === 'physical') {
            const usersWithRole = await ztusers.countDocuments({ 
                "ROLES.ROLEID": id 
            });
            if (usersWithRole > 0) {
                throw { 
                    code: 400, 
                    message: `No se puede eliminar: Rol ${id} está asignado a ${usersWithRole} usuario(s)` 
                };
            }
            
            await ztroles.deleteOne({ ROLEID: id });
            return {
                code: 200,
                message: "Rol borrado físicamente exitosamente",
                deletedRole: role
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
                    ...(role.DETAIL_ROW?.DETAIL_ROW_REG
                        ?.filter(reg => typeof reg === 'object' && reg !== null)
                        ?.map(reg => ({ ...reg, CURRENT: false })) || []),
                    newRegistry
                ]
            }
        };

        const updatedRole = await ztroles.findOneAndUpdate(
            { ROLEID: id },
            { $set: updateObject },
            { new: true, lean: true }
        );

        return {
            code: 200,
            message: "Rol borrado lógicamente exitosamente",
            updatedRole
        };

    } catch (error) {
        throw { code: error.code || 500, message: `Error al borrar rol: ${error.message}` };
    }
}

// --- GET ALL ---
async function GetAllUsers() {
    try {
        const users = await ztusers.find({}).lean(); 
      
        return users;
    } catch (error) {
        console.error("Error en GetAllUsers:", error);
        throw error;
    }
}

async function GetAllRoles() {
    try {
        const roles = await ztroles.find({}).lean(); //lean para que parsie en json si no me truena xd
        return roles;
    } catch (error) {
        console.error("Error en GetAllRoles:", error);
        throw error;
    }
}
// --- GET USER BY ID ---
async function GetUserById(userId) {
    try {
        const user = await ztusers.findOne({ USERID: userId }).lean();
        if (!user) throw new Error(`Usuario con USERID ${userId} no encontrado`);
        return user;
    } catch (error) {
        console.error("Error en GetUserById:", error);
        throw error;
    }
}

// --- GET ROLE BY ID ---
async function GetRoleById(roleId) {
    try {
        const role = await ztroles.findOne({ ROLEID: roleId }).lean();
        if (!role) throw new Error(`Rol con ROLEID ${roleId} no encontrado`);
        return role;
    } catch (error) {
        console.error("Error en GetRoleById:", error);
        throw error;
    }
}

async function CreateUser(req) {
    const { user } = req.body;
    if (!user?.USERID) throw new Error("USERID es requerido");

    try {
        const exists = await ztusers.findOne({ USERID: user.USERID });
        if (exists) throw new Error(`Ya existe un usuario con USERID ${user.USERID}`);

        if (user.ROLES) {
            await validateRolesExist(user.ROLES);
        }

        user.DETAIL_ROW = {
            ACTIVED: true,
            DELETED: false,
            DETAIL_ROW_REG: updateAuditLog([], req.user?.id || 'aramis')
        };

        await ztusers.create(user);

        return { success: true, USERID: user.USERID };
    } catch (error) {
        console.error("Error al crear el usuario:", error.message);
        throw error;
    }
}

async function CreateRole(req) {
    const { role } = req.body;
    console.log(role);
    if (!role?.ROLEID) throw new Error("ROLEID es requerido");

    try {
        const exists = await ztroles.findOne({ ROLEID: role.ROLEID });
        if (exists) throw new Error(`Ya existe un rol con ROLEID ${role.ROLEID}`);


        role.DETAIL_ROW = {
            ACTIVED: true,
            DELETED: false,
            DETAIL_ROW_REG: updateAuditLog([], req.user?.id || 'aramis')
        };

        await ztroles.create(role);

        return { success: true, ROLEID: role.ROLEID };
    } catch (error) {
        console.error("Error al crear el rol:", error.message);
        throw error;
    }
}

module.exports = {
    PatchUserOrRole,
    DeleteUserOrRole,
    GetAllUsers,
    GetAllRoles,
    GetUserById,  // exportamos la nueva función
    GetRoleById,   // exportamos la nueva función
    CreateUser,
    CreateRole
};
