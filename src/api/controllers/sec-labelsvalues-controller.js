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
            
            //llamada al metodo de servicio y retorna el resultado de la ruta
           return servicio.GetAllLabelsValues(req);
        });

        // this.on("addone", async (req)=>{
        //     return servicio.AddOnePricesHistory(req);
        // })

        this.on("updateLabel", async (req)=>{
            return servicio.UpdateLabelsValues(req);
        })

        this.on("deleteLabelOrValue", async (req)=>{
            return servicio.DeleteLabelsValues(req);
        })

        this.on("createLabel", async (req) => {
            try {
                // Verifica que req.data contenga el objeto que esperas
                console.log("Datos recibidos: ", req.data);  // Muestra los datos que estás recibiendo en la consola
       
                const result = await servicio.PostLabelsValues(req);
                return result;
            } catch (error) {
                console.error("Error al procesar la solicitud:", error);  // Registra el error completo
                return { message: "Error al procesar la solicitud", error: error.message || error };
            }
        });
       

        return await super.init();
    };


};

module.exports = InvestionsClass;