const cds = require('@sap/cds');
const servicio = require('../services/sec-usersroles-service');

class UsersRolesController extends cds.ApplicationService {
    async init() {
        // DELETE unificado
      // DELETE unificado
        this.on('delete', async (req) => {
            const { type, id } = req.data;
            
            try {
                // Llamada al servicio DeleteUserOrRole
                const result = await servicio.DeleteUserOrRole({ 
                    body: { 
                        [type === 'user' ? 'USERID' : 'ROLEID']: id 
                    } 
                });
                
                return result;  // Si la eliminación fue exitosa, retornamos el resultado

            } catch (error) {
                // Si ocurre un error, capturamos el mensaje y lo enviamos como respuesta al frontend
                console.error("Error al eliminar:", error);
                req.error(400, error.message);  // Devolvemos el error con un código 400 y el mensaje
            }
        });


        // UPDATE unificado (estilo labels-values)
        this.on('update', async (req) => {
            const { type, user, role } = req.data;

            try {
                if (type === 'user') {
                    if (!user?.USERID) throw { code: 'USERID_REQUIRED', message: "USERID es requerido" };
                    return await servicio.PatchUser({
                        body: {
                            type: 'user',
                            id: user.USERID,
                            data: user
                        }
                    });
                } else if (type === 'role') {
                    if (!role?.ROLEID) throw { code: 'ROLEID_REQUIRED', message: "ROLEID es requerido" };
                    return await servicio.PatchRole({
                        body: {
                            type: 'role',
                            id: role.ROLEID,
                            data: role
                        }
                    });
                }
                throw { code: 'INVALID_TYPE', message: "Tipo inválido. Use 'user' o 'role'" };
            } catch (error) {
                console.error("Error en update:", error);
                req.error(error.code || 500, error.message || "Error inesperado");
            }
        });


        // GET ALL USERS
        this.on('fetchAll', async (req) => {
            try {
                const users = await servicio.GetAllUsers();
                return users;
            } catch (error) {
                console.error("Error leyendo usuarios:", error);
                req.error(500, "Error al obtener usuarios");
            }
        });

     
       // GET USER BY ID
       this.on('READ', 'Users', async (req) => {
        const { USERID } = req.data;  // Se obtiene el parámetro USERID de la URL
        try {
            const user = await servicio.GetUserById(USERID); // Llamada al servicio para obtener usuario por ID
            return user;
        } catch (error) {
            console.error("Error obteniendo usuario por ID:", error);
            req.error(500, "Error al obtener usuario");
        }
    });

        // GET ALL ROLES
        this.on('READ', 'Roles', async (req) => {
            try {
                const roles = await servicio.GetAllRoles();
                return roles;
            } catch (error) {
                console.error("Error leyendo roles:", error);
                req.error(500, "Error al obtener roles");
            }
        });

        // GET ROLE BY ID
        this.on('READ', 'Role', async (req) => {
            const { ROLEID } = req.data;
            
            try {
                const role = await servicio.GetRoleById(ROLEID); // Llamada al servicio para obtener rol por ID
                return role;
            } catch (error) {
                console.error("Error obteniendo rol por ID:", error);
                req.error(500, "Error al obtener rol");
            }
        });

        // POST 
        this.on('create', async (req) => {
            const { type, user, role } = req.data;

            if (type === 'user') {
                if (!user?.USERID) throw new Error("USERID es requerido");
                return await servicio.CreateUser({ body: { user }, user: req.user });
            } else if (type === 'role') {
                if (!role?.ROLEID) throw new Error("ROLEID es requerido");
                return await servicio.CreateRole({ body: { role }, user: req.user });
            }

            throw new Error("Tipo inválido. Use 'user' o 'role'");
        });


        await super.init();
    }
}

module.exports = UsersRolesController;
