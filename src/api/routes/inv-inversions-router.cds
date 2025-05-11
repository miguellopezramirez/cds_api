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
        start_date: String,
        end_date: String,
        short_ma: Integer,
        long_ma: Integer
    ) 
    returns String;
};
