using {inv as myph} from '../models/inv-inversions';

@impl: 'src/api/controllers/inv-inversions-controller.js'
service PricesHistoryRoute @(path:'/api/inv') {
    entity priceshistory as projection on myph.priceshistory;
    entity simulations as projection on myph.simulations;

    @Core.Description:'get-all-prices-history'
    @path : 'pricehistory'
    function pricehistory()
    returns array of priceshistory;

    @Core.Description:'Simulate MA Crossover strategy'
    @path: 'simulation'
    action simulation(
        strategy: String,
        symbol: String, 
        startDate: String,
        endDate: String,
        amount: Decimal,
        userId: String,
        specs: String,
    ) 
    returns String;

    @Core.Description:'get-all-strategys'
    @path : 'strategy'
    function strategy()
    returns array of String;

    @Core.Description:'get-all-simulations'
    @path : 'getSimulation'	
    action getSimulation(idUser: String, id: String)
    returns array of simulations;

    @Core.Description:'delete simulation by id and user'
    @path : 'deleteSimulation'
    action deleteSimulation(
        idUser : String
    )
    returns String;

    //updateSimulation
    @Core.Description: 'Actualizar nombre de simulación por ID'
    @path: 'updatesimulation'
    action updatesimulation(
        id: String,
        simulationName: String
    ) returns String;
};
