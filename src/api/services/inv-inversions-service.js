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
    if (!fullHistory || fullHistory.length === 0) {
        throw new Error("Full history data is required");
    }

    let startIndex = 0;
    if (startDate) {
        startIndex = fullHistory.findIndex(item => item && item.date >= new Date(startDate));
        if (startIndex === -1) startIndex = fullHistory.length - 1;
        startIndex = Math.max(0, startIndex - longMa);
    }

    let workingData = fullHistory.slice(startIndex);
    if (endDate) {
        workingData = workingData.filter(item => item && item.date <= new Date(endDate));
    }

    // Validación de datos de trabajo
    if (workingData.length === 0) {
        throw new Error("No data available for the selected date range");
    }

    const dataWithMAs = workingData.map((item, index, array) => {
        if (!item || !item.close) {
            console.warn(`Invalid item at index ${index}`);
            return null;
        }

        const shortSlice = array.slice(Math.max(0, index - shortMa + 1), index + 1);
        const longSlice = array.slice(Math.max(0, index - longMa + 1), index + 1);
        
        return {
            price_history: {
                ...item,
                date: item.date
            },
            short_ma: shortSlice.length >= shortMa ? 
                shortSlice.reduce((sum, p) => p && p.close ? sum + p.close : sum, 0) / shortMa : null,
            long_ma: longSlice.length >= longMa ? 
                longSlice.reduce((sum, p) => p && p.close ? sum + p.close : sum, 0) / longMa : null
        };
    }).filter(item => item !== null && item.price_history && item.price_history.date && item.short_ma !== null && item.long_ma !== null);
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
                    date: current.price_history.date.toISOString().split('T')[0],
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
                    date: current.price_history.date.toISOString().split('T')[0],
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
                    date: current.price_history.date.toISOString().split('T')[0],
                    type: 'sell',
                    price: stopLoss,
                    reasoning: `Stop-loss triggered at ${stopLoss}`,
                    isStopLoss: true
                });
                currentPosition = null;
            } else if (current.price_history.high >= takeProfit) {
                signals.push({
                    date: current.price_history.date.toISOString().split('T')[0],
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
                    date: current.price_history.date.toISOString().split('T')[0],
                    type: 'buy',
                    price: stopLoss,
                    reasoning: `Stop-loss triggered at ${stopLoss}`,
                    isStopLoss: true
                });
                currentPosition = null;
            } else if (current.price_history.low <= takeProfit) {
                signals.push({
                    date: current.price_history.date.toISOString().split('T')[0],
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
            date: item.price_history.date.split('T')[0],
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
    
    if (!Array.isArray(specsArray)) return defaults;

    const result = { ...defaults };
    
    specsArray.forEach(item => {
        if (!item || !item.INDICATOR) return;
        
        const key = item.INDICATOR.toUpperCase();
        const value = parseInt(item.VALUE);
        
        if (!isNaN(value)) {
            if (key === 'SHORT_MA' && value >= 5) {
                result.SHORT_MA = value;
            } else if (key === 'LONG_MA' && value >= 20) {
                result.LONG_MA = value;
            }
        }
    });

    // Validar que SHORT_MA sea menor que LONG_MA
    if (result.SHORT_MA >= result.LONG_MA) {
        result.LONG_MA = result.SHORT_MA + 50;
    }

    return result;
}
async function SimulateMACrossover(body) {
    try {
        // Versión adaptada al controlador existente
        // body ya es el objeto SIMULATION que viene del controlador
        const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = body;

        // Validación de parámetros
        const requiredFields = ['SYMBOL', 'STARTDATE', 'ENDDATE', 'AMOUNT', 'USERID', 'SPECS'];
        const missingFields = requiredFields.filter(field => !body[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Faltan campos requeridos en SIMULATION: ${missingFields.join(', ')}`);
        }

        // Obtener datos históricos
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        
        if (!response.data || !response.data['Time Series (Daily)']) {
            throw new Error("Invalid data format from Alpha Vantage API");
        }

        const timeSeries = response.data['Time Series (Daily)'];

        // Procesar datos históricos
        let history = Object.entries(timeSeries)
            .map(([date, data]) => {
                if (!data || !data['4. close']) {
                    console.warn(`Datos incompletos para la fecha ${date}`);
                    return null;
                }
                return {
                    date: new Date(date),
                    open: parseFloat(data['1. open']),
                    high: parseFloat(data['2. high']),
                    low: parseFloat(data['3. low']),
                    close: parseFloat(data['4. close']),
                    volume: parseInt(data['5. volume'])
                };
            })
            .filter(item => item !== null)
            .sort((a, b) => a.date - b.date);

        if (history.length === 0) {
            throw new Error("No valid historical data found");
        }

        // Parsear especificaciones
        const { SHORT_MA: shortMa, LONG_MA: longMa } = parseSpecs(SPECS);

        // Calcular medias móviles y señales
        const { priceData, signals } = calculateMovingAverageData(history, STARTDATE, ENDDATE, shortMa, longMa);

        // Simular transacciones
        let currentCash = AMOUNT;
        let sharesHeld = 0;
        let totalBought = 0;
        let totalSold = 0;
        
        const processedSignals = signals.map(signal => {
            if (signal.type === 'buy' && currentCash > 0) {
                const shares = currentCash / signal.price;
                sharesHeld += shares;
                totalBought += shares;
                currentCash = 0;
                
                return {
                    DATE: signal.date.split('T')[0],
                    TYPE: 'buy',
                    PRICE: signal.price,
                    REASONING: signal.reasoning,
                    SHARES: shares
                };
            } else if (signal.type === 'sell' && sharesHeld > 0) {
                const proceeds = sharesHeld * signal.price;
                totalSold += sharesHeld;
                currentCash += proceeds;
                const shares = sharesHeld;
                sharesHeld = 0;
                
                return {
                    DATE: signal.date.split('T')[0],
                    TYPE: 'sell',
                    PRICE: signal.price,
                    REASONING: signal.reasoning,
                    SHARES: shares
                };
            }
            return null;
        }).filter(Boolean);

        // Cerrar posición final si queda algo abierto
        if (sharesHeld > 0) {
            const lastPrice = priceData[priceData.length - 1].close;
            const proceeds = sharesHeld * lastPrice;
            totalSold += sharesHeld;
            currentCash += proceeds;
            
            processedSignals.push({
                DATE: priceData[priceData.length - 1].date,
                TYPE: 'sell',
                PRICE: lastPrice,
                REASONING: 'Final position closed at end of period',
                SHARES: sharesHeld
            });
            
            sharesHeld = 0;
        }

        // Calcular métricas finales
        const finalValue = sharesHeld * priceData[priceData.length - 1].close;
        const finalBalance = currentCash + finalValue;
        const profit = finalBalance - AMOUNT;
        const percentageReturn = (profit / AMOUNT) * 100;

        // Formatear datos para el gráfico
        const chartData = priceData.map(item => ({
            DATE: item.date,
            OPEN: item.open,
            HIGH: item.high,
            LOW: item.low,
            CLOSE: item.close,
            VOLUME: item.volume,
            INDICATORS: [
                { INDICATOR: 'short_ma', VALUE: item.short_ma },
                { INDICATOR: 'long_ma', VALUE: item.long_ma }
            ]
        }));

        // Formatear SPECS como string
        const formattedSpecs = [
            { INDICATOR: "SHORT_MA", VALUE: shortMa },
            { INDICATOR: "LONG_MA", VALUE: longMa }
        ];


        // Crear objeto de simulación
        const simulationData = {
            SIMULATIONID: `${SYMBOL}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`,
            USERID,
            STRATEGY: 'IdCM',
            SIMULATIONNAME: `${SYMBOL}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`,
            SYMBOL,
            STARTDATE: new Date(STARTDATE),
            ENDDATE: new Date(ENDDATE),
            AMOUNT,
            SIGNALS: processedSignals,
            SPECS: formattedSpecs,
            SUMMARY: {
                TOTAL_BOUGHT_UNITS: totalBought,
                TOTAL_SOLDUNITS: totalSold,
                REMAINING_UNITS: sharesHeld,
                FINAL_CASH: currentCash,
                FINAL_VALUE: finalValue,
                FINAL_BALANCE: finalBalance,
                REAL_PROFIT: profit,
                PERCENTAGE_RETURN: percentageReturn
            },
            CHART_DATA: chartData,
            DETAIL_ROW: {
                ACTIVED: true,
                DELETED: false,
                DETAIL_ROW_REG: [{
                    CURRENT: true,
                    REGDATE: new Date(),
                    REGTIME: new Date().toTimeString().split(' ')[0],
                    REGUSER: USERID
                }]
            }
        };

        // Guardar en MongoDB
        const newSimulation = new Simulation(simulationData);
        await newSimulation.save();

        return simulationData;
    
    } catch (e) {
        console.error('Error in SimulateMACrossover:', {
            message: e.message,
            stack: e.stack,
            inputBody: body
        });
        throw new Error(`Simulation failed: ${e.message}`);
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