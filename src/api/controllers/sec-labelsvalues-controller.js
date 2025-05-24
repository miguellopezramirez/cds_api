//1.-importacion de las librerias
const cds = require ('@sap/cds');

//2.-importar el servicio
// aun no esta creado el servicio
const servicio = require('../services/sec-labelsvalues-services')
//3.- estructura princiapl  de la clas de contorller


class InvestionsClass extends cds.ApplicationService{

    //4.-iniciiarlizarlo de manera asincrona
    async init (){

        this.on('getAllLabels', async (req)=> {
            try {
                const {type} = req.data;
                if (type!== '') {
                return servicio.GetAllLabelsValues(req);
                }else {
                    throw ( {code: 400, message: "Falta el type para values o labels"} );
                }

            }catch (error) {    
                // console.log("Error al procesar la solicitud:", error.code, error.message);  // Registra el error completo
                req.error(error.code || 500, error.message || "Error inesperado");
            }
            
            //llamada al metodo de servicio y retorna el resultado de la ruta
          
        });

        // this.on("addone", async (req)=>{
        //     return servicio.AddOnePricesHistory(req);
        // })

        this.on("updateLabel", async (req)=>{
            try {
                return servicio.UpdateLabelsValues(req);
            }catch(error){
                req.error(error.code || 500, error.message || "Error inesperado");
            }
        })

        this.on("deleteLabelOrValue", async (req)=>{
            try {
                return servicio.DeleteLabelsValues(req);
            } catch (error) {
                // console.error("Error al procesar la solicitud:", error);  // Registra el error completo
                 req.error(error.code || 500, error.message || "Error inesperado");
            }
        })

        this.on("createLabel", async (req) => {
            try {
                // Verifica que req.data contenga el objeto que esperas
                // console.log("Datos recibidos: ", req.data);  // Muestra los datos que estás recibiendo en la consola
       
                const result = await servicio.PostLabelsValues(req);
                return result;
            } catch (error) {
                // console.error("Error al procesar la solicitud:", error);  // Registra el error completo
                 req.error(error.code || 500, error.message || "Error inesperado");
            }
        });
       

        return await super.init();
    };


};

module.exports = InvestionsClass;