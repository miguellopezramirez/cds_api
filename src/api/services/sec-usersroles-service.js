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

        //Manejo del borrado lógico 
        if (Object.keys(updates).every(key => key === 'USERID')) {
            updates.DETAIL_ROW = {
                ...user.DETAIL_ROW, 
                DELETED: true,      
                ACTIVED: false
            };
        }
        else {
            updates.DETAIL_ROW = {
                ...user.DETAIL_ROW, 
                DELETED: false,
                ACTIVED: true
            };
        }
        //Agregar registro de DETAIL_ROW
        updates.DETAIL_ROW.DETAIL_ROW_REG = updateAuditLog(
            user.DETAIL_ROW?.DETAIL_ROW_REG || [], 
            req.user?.id || 'aramis'
        );

        //Actualizar datos
        const result = await ztusers.updateOne({ USERID: id }, { $set: updates });
        return { success: true, modifiedCount: result.modifiedCount };

    } catch (error) {
        console.error("Error al actualizar el usuario: ", error.message);
        throw error;
    }
}

async function PatchRole(req) {
    const { body } = req;

    const { id, data: updates = {} } = body;
    if (!id) throw { code: 'ROLEID_REQUIRED', message: "Se requiere ROLEID" };

    try {
        // Verifica que el rol exista
        const role = await ztroles.findOne({ ROLEID: id });
        if (!role || (role.DETAIL_ROW?.DELETED === true))
            throw { code: 'ROLE_NOT_FOUND', message: `Rol con ROLEID ${id} no encontrado` };

        // Si se modifican procesos o privilegios validar que existan
        if (updates.PRIVILEGES) {
            await validatePrivilegesExist(updates.PRIVILEGES);
        }

        // Manejo del borrado lógico
        if (Object.keys(updates).every(key => key === 'ROLEID')) {
            updates.DETAIL_ROW = {
                ...role.DETAIL_ROW,
                DELETED: true,
                ACTIVED: false
            };
        } else {
            updates.DETAIL_ROW = {
                ...role.DETAIL_ROW,
                DELETED: false,
                ACTIVED: true
            };
        }
        // Agregar registro de DETAIL_ROW
        updates.DETAIL_ROW.DETAIL_ROW_REG = updateAuditLog(
            role.DETAIL_ROW?.DETAIL_ROW_REG || [],
            req.user?.id || 'aramis'
        );

        // Actualizar datos
        const result = await ztroles.updateOne({ ROLEID: id }, { $set: updates });
        return { success: true, modifiedCount: result.modifiedCount };

    } catch (error) {
        console.error("Error al actualizar el rol:", error.message || error);
        throw error; // Re-lanzar el error para que el frontend lo reciba
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

// --- Auditoría ---
function updateAuditLog(existingLog = [], currentUser) {
    // Marcar registros anteriores como no actuales
    const updatedLog = existingLog.map(entry => ({ ...entry, CURRENT: false }));

    // Añadir nuevo registro
    updatedLog.push({
        CURRENT: true,
        REGDATE: new Date(),
        REGTIME: new Date(),
        REGUSER: currentUser
    });

    return updatedLog;
}

async function DeleteUserOrRole(req) {
    const { USERID, ROLEID } = req.body;

    try {
        // 1. Determinar entidad (usuario o rol)
        if (USERID) {
            // Eliminar usuario
            const result = await ztusers.deleteOne({ USERID });
            if (result.deletedCount === 0) throw new Error(`Usuario con USERID ${USERID} no encontrado`);
            return { success: true, message: `Usuario ${USERID} eliminado físicamente` };

        } else if (ROLEID) {
            // Validar que el rol no esté en uso
            const usersWithRole = await ztusers.countDocuments({ 
                "ROLES.ROLEID": ROLEID 
            });
            if (usersWithRole > 0) throw new Error(`No se puede eliminar: Rol ${ROLEID} está asignado a ${usersWithRole} usuario(s)`);

            // Eliminar rol
            const result = await ztroles.deleteOne({ ROLEID });
            if (result.deletedCount === 0) throw new Error(`Rol con ROLEID ${ROLEID} no encontrado`);
            return { success: true, message: `Rol ${ROLEID} eliminado físicamente` };

        } else {
            throw new Error("Se requiere USERID o ROLEID");
        }
    } catch (error) {
        console.error("Error al eliminar el registro:", error);
        throw error;
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
    PatchUser,
    PatchRole,
    DeleteUserOrRole,
    GetAllUsers,
    GetAllRoles,
    GetUserById,  // exportamos la nueva función
    GetRoleById,   // exportamos la nueva función
    CreateUser,
    CreateRole
};
