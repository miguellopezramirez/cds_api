//1.-importacion de las librerias
const cds = require ('@sap/cds');

//2.-importar el servicio
// aun no esta creado el servicio
const servicioMongo = require('../services/inv-priceshistory-service-mongodb')
//3.- estructura princiapl  de la clas de contorller


class InvestionsClass extends cds.ApplicationService{

    //4.-iniciiarlizarlo de manera asincrona
    async init (){
        
        //5.-definicion de la ruta
        // Mongo
        this.on('getallMongo', async (req)=> {
            
            //llamada al metodo de servicio y retorna el resultado de la ruta
           return servicioMongo.GetAllPricesHistory(req);
        });

        this.on("addoneMongo", async (req)=>{
            return servicioMongo.AddOnePricesHistory(req);
        })

        this.on("updateoneMongo", async (req)=>{
            return servicioMongo.UpdateOnePricesHistory(req);
        })

        this.on("deleteoneMongo", async (req)=>{
            return servicioMongo.DeleteOnePricesHistory(req);
        })
        return await super.init();
    };


};

module.exports = InvestionsClass;