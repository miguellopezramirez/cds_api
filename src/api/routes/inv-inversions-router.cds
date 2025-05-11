using {inv as myph} from '../models/inv-inversions';

@impl: 'src/api/controllers/inv-inversions-controller.js'
service PricesHistoryRoute @(path:'/api/inv') {
    entity priceshistory as projection on myph.priceshistory;
    entity strategies as projection on myph.strategies;
    
    @Core.Description:'get-all-prices-history'
    @path : 'pricehistory'
    function pricehistory()
    returns array of priceshistory;
};
