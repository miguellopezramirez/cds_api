//import model
using {inv as myph} from '../models/inv-inversions';

@impl: 'src/api/controllers/inv-priceshistory-controller.js'
service PricesHistoryRoute @(path:'/api/inv') {
    //instance the entity
    entity priceshistory as projection on myph.priceshistory;
    entity strategies as projection on myph.strategies;
    entity pricehistoryinput2 as projection on myph.pricehistoryinput2;
    
    //MARL: Ger Some Prices History
    //localhost:3333 /api/priceshistory/getall
    //Cassandra
    @Core.Description:'get-all-prices-history'
    @path : 'getallCassandra'
    function getallCassandra()
    returns array of priceshistory;

    @Core.Description: 'add-oneormanny-prices-history'
    @path: 'addmanyCassandra'
    action addmanyCassandra(prices: array of pricehistoryinput2)
    returns array of priceshistory;

    @Core.Description: 'update-one-prices-history'
    @path: 'updateoneCassandra'
    action updateoneCassandra(price:priceshistory) 
    returns array of priceshistory;

    @Core.Description: 'delete-one-prices-history'
    @path: 'deleteoneCassandra'
    function deleteoneCassandra() 
    returns array of priceshistory;

    //MongoDb
        @Core.Description:'get-all-prices-history'
    @path : 'getall'
    function getallMongo()
    returns array of priceshistory;

    @Core.Description: 'add-one-prices-history'
    @path: 'addone'
    action addoneMongo(prices:priceshistory) returns array of priceshistory;

    @Core.Description: 'update-one-prices-history'
    @path: 'updateone'
    action updateoneMongo(price:priceshistory) 
    returns array of priceshistory;

    @Core.Description: 'delete-one-prices-history'
    @path: 'deleteone'
    function deleteoneMongo() 
    returns array of priceshistory;
};
