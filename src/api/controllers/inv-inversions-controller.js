const cds = require ('@sap/cds');
const servicio = require('../services/inv-inversions-service')

class InvestionsClass extends cds.ApplicationService{
    async init (){
        this.on('pricehistory', async (req)=> {
           return servicio.GetAllPricesHistory(req);
        });
        return await super.init();
    };
};

module.exports = InvestionsClass;