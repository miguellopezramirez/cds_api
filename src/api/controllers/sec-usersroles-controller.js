const cds = require('@sap/cds');
const servicio = require('../services/sec-usersroles-service');

class UsersRolesController extends cds.ApplicationService {
    async init() {
        // DELETE unificado
        this.on('delete', async (req) => {
            try {
                return await servicio.DeleteUserOrRole(req);
            } catch (error) {
                req.error(error.code || 500, error.message || "Error inesperado");
            }
        });

        // UPDATE unificado (estilo labels-values)
        this.on('update', async (req) => {
            try {
                return await servicio.PatchUserOrRole(req);
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
       this.on('READ', 'users', async (req) => {
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
        this.on('READ', 'roles', async (req) => {
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
