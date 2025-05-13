const cds = require ('@sap/cds');
const servicio = require('../services/inv-inversions-service')
const sercivioSimulacion = require('../services/inv-simulation-service');
class InvestionsClass extends cds.ApplicationService{
    async init (){
        this.on('pricehistory', async (req)=> {
           return servicio.GetAllPricesHistory(req);
        });

        this.on('simulation', async (req) => {
            if (!req.req.query.strategy) throw new Error('Strategy parameter required');

            if (req.req.query.strategy?.toLowerCase() === 'macrossover') {
                const result = await servicio.SimulateMACrossover({
                    ...req.data
                });
                return JSON.parse(result);
            }
            else {
                throw new Error('Solo implementado MACrossover strategy');
            }
        });

        this.on('strategy', async (req) => {
            return servicio.GetAllInvestmentStrategies(req);
        })
        this.on('deleteSimulation', async (req) => {
  const idSimulation = req.req.query?.id;
  const idUser = req.data?.idUser;

  return await sercivioSimulacion.deleteSimulation(idSimulation, idUser);
});


        return await super.init();
    };
};

module.exports = InvestionsClass;