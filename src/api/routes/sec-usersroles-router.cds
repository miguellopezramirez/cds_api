using { sec as myur } from '../models/sec-usersroles';

@impl: 'src/api/controllers/sec-usersroles-controller.js'
service UsersRolesService @(path:'/api/sec/usersroles') {
    // Entidades básicas
    entity users as projection on myur.ZTUSERS;
    entity roles as projection on myur.ZTROLES;
    entity Role as projection on myur.ZTROLES;


 //------------------------------rutas de Echauri-----------------------------------------
     // Ruta para obtener todos los usuarios
    @Core.Description: 'Obtiene todos los usuarios'
    @path: 'fetchAllUsers' // El path para la función
    function fetchAll() 
    returns array of users;


   
   
//------------------------------Fin rutas de Echauri uwu--------------------------------

    // DELETE (para usuarios o roles)
    @Core.Description: 'Elimina usuario o rol por ID'
    @path: 'delete'
    function delete() returns {
        success: Boolean;
        message: String;
        value: {};
    };

    // PATCH USERS
    @Core.Description: 'Actualiza usuario'
    @path: 'update'
    action update( user: users, role: roles ) returns {
        success: Boolean;
        message: String;
        value: {};
    };

    // POST USERS / ROLES
    @Core.Description: 'Crea un nuevo usuario o rol'
    @path: 'create'
    action create(
        type: String enum { user; role },
        user: users,
        role: roles
    ) returns {
        success: Boolean;
        USERID: String;
        ROLEID: String;
    };
}