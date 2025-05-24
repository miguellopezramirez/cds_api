const axios = require('axios');
require('dotenv').config(); 
const ztvalues = require('../models/mongodb/ztvalues');
const Simulation = require('../models/mongodb/ztsimulation');
;
async function GetAllPricesHistory(req) {
  try {
    const symbol = req.req.query?.symbol || 'AAPL'; // Parámetro dinámico (ej: /pricehistory?symbol=TSLA)
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

    // Llamada a Alpha Vantage
    const response = await axios.get(url);
    const timeSeries = response.data['Time Series (Daily)'];

    // Transformar datos al formato de la entidad CDS
    return Object.entries(timeSeries).map(([date, data]) => ({
      DATE: date,
      OPEN: data['1. open'],
      HIGH: data['2. high'],
      LOW: data['3. low'],
      CLOSE: data['4. close'],
      VOLUME: data['5. volume'] // Alpha Vantage usa Decimal
    }));

  } catch (e) {
    console.error('AlphaVantage Error:', e);
    throw new Error('Failed to fetch data from Alpha Vantage');
  }
}

// Función auxiliar para calcular stop-loss
function findStopLoss(type, data, currentIndex) {
    const lookback = 20;
    const startIndex = Math.max(0, currentIndex - lookback);
    const slice = data.slice(startIndex, currentIndex);
    
    if (type === 'buy') {
        const minLow = Math.min(...slice.map(d => d.price_history.low));
        return minLow * 0.99;
    } else {
        const maxHigh = Math.max(...slice.map(d => d.price_history.high));
        return maxHigh * 1.01;
    }
}

function calculateMovingAverageData(fullHistory, startDate, endDate, shortMa, longMa) {
    let startIndex = 0;
    if (startDate) {
        startIndex = fullHistory.findIndex(item => item.date >= startDate);
        if (startIndex === -1) startIndex = fullHistory.length - 1;
        startIndex = Math.max(0, startIndex - longMa);
    }

    let workingData = fullHistory.slice(startIndex);
    if (endDate) {
        workingData = workingData.filter(item => item.date <= endDate);
    }

    const dataWithMAs = workingData.map((item, index, array) => {
        const shortSlice = array.slice(Math.max(0, index - shortMa + 1), index + 1);
        const longSlice = array.slice(Math.max(0, index - longMa + 1), index + 1);
        
        return {
            price_history: {
                ...item,
                date: item.date
            },
            short_ma: shortSlice.length >= shortMa ? 
                shortSlice.reduce((sum, p) => sum + p.close, 0) / shortMa : null,
            long_ma: longSlice.length >= longMa ? 
                longSlice.reduce((sum, p) => sum + p.close, 0) / longMa : null
        };
    }).filter(item => item.price_history.date && item.short_ma !== null && item.long_ma !== null);

    const signals = [];
    let currentPosition = null;
    let entryPrice = 0;
    let stopLoss = 0;
    let takeProfit = 0;

    for (let i = 1; i < dataWithMAs.length; i++) {
        const prev = dataWithMAs[i-1];
        const current = dataWithMAs[i];
        
        if (prev.short_ma < prev.long_ma && current.short_ma > current.long_ma) {
            if (currentPosition !== 'buy') {
                entryPrice = current.price_history.close;
                stopLoss = findStopLoss('buy', dataWithMAs, i);
                takeProfit = entryPrice + (2 * (entryPrice - stopLoss));
                
                signals.push({
                    date: current.price_history.date,
                    type: 'buy',
                    price: entryPrice,
                    reasoning: `Golden Cross: ${shortMa}MA crossed above ${longMa}MA`,
                    stopLoss,
                    takeProfit
                });
                
                currentPosition = 'buy';
            }
        }
        else if (prev.short_ma > prev.long_ma && current.short_ma < current.long_ma) {
            if (currentPosition !== 'sell') {
                entryPrice = current.price_history.close;
                stopLoss = findStopLoss('sell', dataWithMAs, i);
                takeProfit = entryPrice - (2 * (stopLoss - entryPrice));
                
                signals.push({
                    date: current.price_history.date,
                    type: 'sell',
                    price: entryPrice,
                    reasoning: `Death Cross: ${shortMa}MA crossed below ${longMa}MA`,
                    stopLoss,
                    takeProfit
                });
                
                currentPosition = 'sell';
            }
        }
        else if (currentPosition === 'buy') {
            if (current.price_history.low <= stopLoss) {
                signals.push({
                    date: current.price_history.date,
                    type: 'sell',
                    price: stopLoss,
                    reasoning: `Stop-loss triggered at ${stopLoss}`,
                    isStopLoss: true
                });
                currentPosition = null;
            } else if (current.price_history.high >= takeProfit) {
                signals.push({
                    date: current.price_history.date,
                    type: 'sell',
                    price: takeProfit,
                    reasoning: `Take-profit triggered at ${takeProfit}`,
                    isTakeProfit: true
                });
                currentPosition = null;
            }
        }
        else if (currentPosition === 'sell') {
            if (current.price_history.high >= stopLoss) {
                signals.push({
                    date: current.price_history.date,
                    type: 'buy',
                    price: stopLoss,
                    reasoning: `Stop-loss triggered at ${stopLoss}`,
                    isStopLoss: true
                });
                currentPosition = null;
            } else if (current.price_history.low <= takeProfit) {
                signals.push({
                    date: current.price_history.date,
                    type: 'buy',
                    price: takeProfit,
                    reasoning: `Take-profit triggered at ${takeProfit}`,
                    isTakeProfit: true
                });
                currentPosition = null;
            }
        }
    }

    if (currentPosition && signals.length > 0) {
        const lastSignal = signals[signals.length - 1];
        const lastPrice = dataWithMAs[dataWithMAs.length - 1].price_history.close;
        
        signals.push({
            date: dataWithMAs[dataWithMAs.length - 1].price_history.date,
            type: currentPosition === 'buy' ? 'sell' : 'buy',
            price: lastPrice,
            reasoning: `Final position closed at end of period`,
            isFinal: true
        });
    }

    return {
        priceData: dataWithMAs.map(item => ({
            date: item.price_history.date,
            open: item.price_history.open,
            high: item.price_history.high,
            low: item.price_history.low,
            close: item.price_history.close,
            volume: item.price_history.volume,
            short_ma: item.short_ma,
            long_ma: item.long_ma
        })),
        signals: signals
    };
}

function parseSpecs(specsArray) {
  const defaults = { SHORT_MA: 50, LONG_MA: 200 };
  const result = { ...defaults };

  if (!Array.isArray(specsArray)) return result;

  // Mapeo de indicadores
  const aliasMap = {
    'SHORT_MA': 'SHORT_MA',
    'LONG_MA': 'LONG_MA'
  };

  // Valores mínimos para cada indicador
  const minValues = { SHORT_MA: 5, LONG_MA: 20 };

  specsArray.forEach(item => {
    if (!item || !item.INDICATOR || item.VALUE === undefined) return;
    
    const rawKey = item.INDICATOR.trim().toUpperCase();
    const key = aliasMap[rawKey] || rawKey; // Usa el alias o el nombre original
    
    const numValue = parseInt(item.VALUE);
    
    if (!isNaN(numValue)) {
      // Si el indicador tiene un valor mínimo definido, lo aplicamos
      const minVal = minValues[key] || 1; // Valor mínimo por defecto 1 para nuevos indicadores
      result[key] = Math.max(minVal, numValue);
    }
  });

  // Mantenemos compatibilidad con el formato anterior devolviendo short/long
  return result;
}

async function SimulateMACrossover(params) { 
    try {
        const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = params || {};

        // Validación de la presencia de todos los parámetros esenciales.
        if (!SYMBOL || !STARTDATE || !ENDDATE || AMOUNT === undefined || !USERID) {
          throw new Error(
            "FALTAN PARÁMETROS REQUERIDOS EN EL CUERPO DE LA SOLICITUD: 'SYMBOL', 'STARTDATE', 'ENDDATE', 'AMOUNT', 'USERID'."
          );
        }
        const { SHORT_MA: shortMa, LONG_MA: longMa } = parseSpecs(SPECS);
        
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        const timeSeries = response.data['Time Series (Daily)'];
    
        let history = Object.entries(timeSeries)
            .map(([date, data]) => ({
            date: new Date(date),
            open: parseFloat(data['1. open']),
            high: parseFloat(data['2. high']),
            low: parseFloat(data['3. low']),
            close: parseFloat(data['4. close']),
            volume: parseInt(data['5. volume'])
        })).sort((a, b) => a.date - b.date);

        const { priceData, signals } = calculateMovingAverageData(history, STARTDATE, ENDDATE, shortMa, longMa);
        
        let currentAmount = AMOUNT;
        let shares = 0;
        const transactions = [];
        
        signals.forEach(signal => {
            if (signal.type === 'buy' && currentAmount > 0) {
                shares = currentAmount / signal.price;
                currentAmount = 0;
                transactions.push({...signal, shares});
            } else if (signal.type === 'sell' && shares > 0) {
                currentAmount = shares * signal.price;
                shares = 0;
                transactions.push({...signal, proceeds: currentAmount});
            }
        });

        if (shares > 0) {
            const lastPrice = priceData[priceData.length - 1].close;
            currentAmount = shares * lastPrice;
            transactions.push({
                date: priceData[priceData.length - 1].date,
                type: 'sell',
                price: lastPrice,
                reasoning: 'Final position closed',
                proceeds: currentAmount,
                isFinal: true
            });
        }

        const profit = currentAmount - AMOUNT;
        const percentageReturn = (profit / AMOUNT) * 100;

        const simulationData = {
            SIMULATIONID: `${SYMBOL}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`,
            USERID,
            STRATEGY: 'CM',
            SIMULATIONNAME: `MA Crossover ${shortMa}/${longMa}`,
            SYMBOL,
            STARTDATE: STARTDATE || new Date(priceData[0].date),
            ENDDATE: ENDDATE || new Date(priceData[priceData.length - 1].date),
            AMOUNT: AMOUNT,
            SIGNALS: signals,
            SPECS: SPECS || `SHORT:${shortMa}&LONG:${longMa}`,
            //result: currentAmount,
            //percentageReturn: percentageReturn,
            SUMMARY: {
                TOTAL_BOUGHT_UNITS: signals.filter(s => s.type === 'buy').reduce((acc, s) => acc + s.shares, 0),
                TOTAL_SOLDUNITS: signals.filter(s => s.type === 'sell').reduce((acc, s) => acc + s.shares, 0),
                REMAINING_UNITS: shares,
                FINAL_CASH: currentAmount,
                FINAL_VALUE: 0, //currentAmount + (shares * priceData[priceData.length - 1].close),
                FINAL_BALANCE: 0, //currentAmount + (shares * priceData[priceData.length - 1].close),
                REAL_PROFIT: profit,
                PERCENTAGE_RETURN: percentageReturn
            },
            CHART_DATA: priceData,
            //transactions: transactions,
            DETAIL_ROW: {
                ACTIVED: true,
                DELETED: false,
                DETAIL_ROW_REG: [{
                    CURRENT: true,
                    REGDATE: new Date(),
                    REGTIME: new Date(),
                    REGUSER: "SYSTEM"
                }]
            }
        };

        // Guardar en MongoDB
        const newSimulation = new Simulation(simulationData);
        await newSimulation.save();

        return simulationData;
    
    } catch (e) {
        console.error('Error in SimulateMACrossover:', e);
        return JSON.stringify({
            success: false,
            error: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }
}
// MALR: Función para cargar todas las estrategias de inversión en el front
async function GetAllInvestmentStrategies() {
    try {
        // 1. Obtener datos
        const strategies = await ztvalues.find({ LABELID: 'IdStrategies' });
        const indicators = await ztvalues.find({ LABELID: 'IdIndicators' });

        if (!strategies?.length) {
            throw new Error('No se encontraron estrategias');
        }

        // 2. Procesar indicadores
        const indicatorsByStrategy = {};
        
        indicators.forEach(indicator => {
            // Extraer el ID de estrategia (segunda parte después del guión)
            const parts = indicator.VALUEPAID.split('-');
            
            if (parts.length !== 2 || parts[0] !== 'IdStrategies') {
                console.warn(`Formato inválido en VALUEPAID: ${indicator.VALUEPAID}`);
                return;
            }
            
            const strategyId = parts[1]; // IdCMM, IdRSI, etc.
            
            if (!indicatorsByStrategy[strategyId]) {
                indicatorsByStrategy[strategyId] = [];
            }
            
            indicatorsByStrategy[strategyId].push({
                ID: indicator.VALUEID,      
                NAME: indicator.VALUE,       
                DESCRIPTION: indicator.DESCRIPTION,
            });
        });

        // 3. Combinar datos
        const result = strategies.map(strategy => ({
            ID: strategy.VALUEID,           
            NAME: strategy.VALUE, 
            ALIAS: strategy.ALIAS,          
            DESCRIPTION: strategy.DESCRIPTION,
            IMAGE: strategy.IMAGE,
            INDICATORS: indicatorsByStrategy[strategy.VALUEID] || []
        }));
        return result;
        
    } catch (error) {
        throw new Error('Error al obtener estrategias con indicadores');
    }
}

// CERF: Me confundi con los "simbolos" que era necesario traer, no lo borro por si acaso
async function GetAllSymbols() {
    try {
       const symbols = await ZTSIMULATION.distinct('symbol');
       return symbols;
   } catch (error) {
       throw new Error(`Error al obtener los símbolos: ${error.message}`);
   }
  }
  
  // CERF: Busca y trae simbolo e informacion de la empresa
  async function GetAllCompanies(req) {
  const keyword = req.data?.keyword || 'a';
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${keyword}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
  
  try {
   const response = await axios.get(url);
   const data = response.data['bestMatches'];
  
   if (!data) return [];
  
   return data.map(entry => ({
     symbol: entry['1. symbol'],
     name: entry['2. name'],
     type: entry['3. type'],
     region: entry['4. region'],
     marketOpen: entry['5. marketOpen'],
     marketClose: entry['6. marketClose'],
     timezone: entry['7. timezone'],
     currency: entry['8. currency'],
     matchScore: entry['9. matchScore']
   }));
  } catch (error) {
   throw new Error(`Error al traer los símbolos: ${error.message}`);
  }
}
  

////////////////////////

// Función para calcular SMA
function calcularSMA(data, periodo) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < periodo - 1) {
      sma.push(null);
      continue;
    }
    const ventana = data.slice(i - periodo + 1, i + 1);
    const suma = ventana.reduce((acc, d) => acc + d.close, 0);
    sma.push(suma / periodo);
  }
  return sma;
}

// Función principal de cálculo
async function calcularSoloSMA({ symbol = 'AAPL', startDate, endDate, specs }) {
  try {
    const { short, long } = parseSpecs(specs);

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
    const response = await axios.get(url);
    const timeSeries = response.data['Time Series (Daily)'];

    if (!timeSeries) throw new Error('Datos no disponibles');

    let history = Object.entries(timeSeries).map(([date, data]) => ({
      date: new Date(date),
      close: parseFloat(data['4. close']),
    }));

    // Ordenar por fecha ascendente
    history = history.sort((a, b) => a.date - b.date);

    // Filtrar fechas si se pasan
    const filtered = history.filter(d => {
      const date = new Date(d.date);
      return (!startDate || date >= new Date(startDate)) &&
             (!endDate || date <= new Date(endDate));
    });

    // Calcular SMA
    const smaShort = calcularSMA(filtered, short);
    const smaLong = calcularSMA(filtered, long);

    // Armar respuesta combinada
    const resultado = filtered.map((item, idx) => ({
      date: item.date,
      close: item.close,
      short: smaShort[idx],
      long: smaLong[idx]
    }));

    return resultado;
  } catch (error) {
    console.error('Error en calcularSoloSMA:', error.message);
    throw new Error('Error al calcular SMA: ' + error.message);
  }
}

module.exports = { GetAllPricesHistory, SimulateMACrossover, GetAllInvestmentStrategies, GetAllSymbols, GetAllCompanies, calcularSoloSMA  };