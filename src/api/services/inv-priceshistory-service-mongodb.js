const ztpriceshistory =require('../models/mongodb/ztpriceshistory');

async function GetAllPricesHistory(req) {
    try{
        const idPrice = parseInt(req.req.query?.IdPrice);
        const initVolume = parseInt(req.req.query?.initVolume);
        const endVolume = parseInt(req.req.query?.endVolume);
        let priceHistory;
        if (idPrice>0){
            priceHistory = await ztpriceshistory.findOne({ID:idPrice}).lean();
        }else if(initVolume >= 0 && endVolume >= 0){
            priceHistory = await ztpriceshistory.find({
                VOLUME: {
                    $gte: initVolume, $lte:endVolume
                }
            }).lean();
        }
        else{
            priceHistory = await ztpriceshistory.find().lean();
        }
        // pricesHistory=JSON.stringify(pricesHistory);
        // console.log(pricesHistory)
        return (priceHistory);
    }catch(e){
        console.error(e)
    }
}

async function AddOnePricesHistory(req){
    try{
        const newPrices = req.req.body.prices;
        let pricesHistory;
        pricesHistory = await ztpriceshistory.insertMany(newPrices, {order: true});
        return(JSON.parse(JSON.stringify(pricesHistory)));
    }catch(error){
        return error;
    }
} 

async function UpdateOnePricesHistory(req){
    try{
        const idPrice = req.req.query?.IdPrice
        const newData = req.req.body.price;


        const updatedPrice = await ztpriceshistory.findOneAndUpdate(
            { ID: idPrice },       // Filtro por ID
            newData,          // Datos a actualizar
            { new: true }     // Devuelve el documento actualizado
        );

        return(JSON.parse(JSON.stringify({updatedPrice})));
    }catch(error){
        console.log(error)
        return error;
    }
}

async function DeleteOnePricesHistory(req){
    try{
        const idPrice = req.req.query?.IdPrice


        const deletionResult = await ztpriceshistory.findOneAndDelete(
            { ID: idPrice }  // Filtro por ID
        );

        return(JSON.parse(JSON.stringify({deletionResult})));
    }catch(error){
        console.log(error)
        return error;
    }
}


module.exports = { GetAllPricesHistory, AddOnePricesHistory, UpdateOnePricesHistory,DeleteOnePricesHistory };