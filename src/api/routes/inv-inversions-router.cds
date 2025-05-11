using {inv as myph} from '../models/inv-inversions';

@impl: 'src/api/controllers/inv-inversions-controller.js'
service PricesHistoryRoute @(path:'/api/inv') {
    entity priceshistory as projection on myph.priceshistory;
    
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
};
