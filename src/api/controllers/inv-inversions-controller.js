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
        //delete
// 🧩 Endpoint para borrar simulaciones (físico o lógico)
this.on('deleteSimulation', async (req) => {
  try {
    const idSimulation = req.req.query?.id;
    const tipo = req.req.query?.type || "fisic"; // 👈 "logic" o "fisic"
const idUser = req.data.USERID;

    // 🛑 Validación de parámetros obligatorios
    if (!idSimulation || !idUser) {
      req.error(400, "Faltan parámetros obligatorios: id (query) e idUser (body).");
      return;
    }

    // ✅ Llamar al servicio correctamente
    const result = await sercivioSimulacion.deleteSimulation(idSimulation, idUser, tipo);
    return result;

  } catch (error) {
    console.error("❌ Error en deleteSimulation:", error.message);
    req.error(500, `Error al eliminar la simulación: ${error.message}`);
  }
});


    // getSimulation
    // Se espera que el idUser venga como un parámetro de consulta o sin este par un Get all
    this.on ('getSimulation', async (req) => {
        return sercivioSimulacion.getAllSimulaciones(req);
    });



        //updateSimulation
        this.on('updatesimulation', async (req) => {
            const { id, simulationName } = req.data;
        
            if (!id || !simulationName) {
                req.error(400, 'Faltan parámetros: id y simulationName son requeridos.');
                return;
            }
        
            try {
                const updated = await sercivioSimulacion.updateSimulationName(id, simulationName);
                return updated;
            } catch (err) {
                console.error("Error en updatesimulation:", err.message);
                req.error(500, err.message);
            }
        });

        this.on('symbols', async (req) => {
            try {
                const symbols = await servicio.GetAllSymbols();
                return symbols; 
            } catch (error) {
                throw new Error(`Error al traer los símbolos: ${error.message}`);
            }
        });

        this.on('company', async (req) => {
            return await servicio.GetAllCompanies(req);
        });

        this.on('calculateSMA', async (req) => {
            const { symbol, startDate, endDate, specs } = req.data;
          
            const resultado = await servicio.calcularSoloSMA({
              symbol,
              startDate,
              endDate,
              specs
            });
          
            return resultado;
          });
        
        return await super.init();
    };
};



module.exports = InvestionsClass;