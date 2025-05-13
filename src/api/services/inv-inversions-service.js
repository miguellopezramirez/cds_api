const axios = require('axios');
require('dotenv').config(); 
const ztvalues = require('../models/mongodb/ztvalues');


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

// empiezo a documentar yo - aramis
async function SimulateMACrossover(params) { 
    try {
        const symbol = params?.symbol || 'AAPL';
        const startDate = params?.startDate ? new Date(params.startDate) : null;
        const endDate = params?.endDate ? new Date(params.endDate) : null;
        const amount = params?.amount || 1000;
        const { short: shortMa, long: longMa } = parseSpecs(params?.specs);
        
        // Llamada a Alpha Vantage
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        const timeSeries = response.data['Time Series (Daily)'];
    
        // Transformar y filtrar por rango de fechas
        let history = Object.entries(timeSeries)
            .map(([date, data]) => ({
            date: new Date(date),
            open: parseFloat(data['1. open']),
            high: parseFloat(data['2. high']),
            low: parseFloat(data['3. low']),
            close: parseFloat(data['4. close']),
            volume: parseInt(data['5. volume'])
        })).sort((a, b) => a.date - b.date);

        const { priceData, signals } = calculateMovingAverageData(history, startDate, endDate, shortMa, longMa);
        
        //carlos
        // esta parte tú la explicas, creo que es importante manejarlo por separado, de aquí en adelante hasta que se termina la función
        // Calcular resultado financiero
        let currentAmount = amount;
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

        // Si queda posición abierta, cerrarla al último precio
        if (shares > 0) {
            const lastPrice = priceData[priceData.length - 1].price_history.close;
            currentAmount = shares * lastPrice;
            transactions.push({
                date: priceData[priceData.length - 1].price_history.date,
                type: 'sell',
                price: lastPrice,
                reasoning: 'Final position closed',
                proceeds: currentAmount,
                isFinal: true
            });
        }

        const profit = currentAmount - amount;
        const percentageReturn = (profit / amount) * 100;

        const result = {
            idSimulation: `${symbol}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`,
            idUser: params?.userId || null,
            idStrategy: 'CM',
            simulationName: `MA Crossover ${shortMa}/${longMa}`,
            symbol,
            startDate: startDate?.toISOString().split('T')[0] || 'auto',
            endDate: endDate?.toISOString().split('T')[0] || 'auto',
            amount: amount,
            signals: signals,
            specs: params?.specs || `SHORT:${shortMa}&LONG:${longMa}`,
            result: currentAmount,
            percentageReturn: percentageReturn,
            chart_data: priceData,
            transactions: transactions,
            DETAIL_ROW: [
                {
                    ACTIVED: false,
                    DELETED: false,
                    DETAIL_ROW_REG: [
                        {
                            CURRENT: true,
                            REGDATE: new Date().toISOString(),
                            REGTIME: new Date().toISOString(),
                            REGUSER: "SYSTEM"
                        }
                    ]
                }
            ]
        };
      
        return JSON.stringify(result);
    
    } catch (e) {
        console.error('AlphaVantage Error:', e);
        return JSON.stringify({
            success: false,
            error: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }
}

//aquí igual, yo empiezo a documentar con lo que hice - aramis
function calculateMovingAverageData(fullHistory, startDate, endDate, shortMa, longMa) {
    // Encontrar índice de inicio (retroceder 200 días)
    let startIndex = 0;
    if (startDate) {
        startIndex = fullHistory.findIndex(item => item.date >= startDate);
        if (startIndex === -1) startIndex = fullHistory.length - 1;
        // Retroceder los días necesarios para calcular MA larga
        startIndex = Math.max(0, startIndex - longMa);
    }

    // Filtrar el rango completo necesario
    let workingData = fullHistory.slice(startIndex);
    if (endDate) {
        workingData = workingData.filter(item => item.date <= endDate);
    }

    // Calcular medias móviles
    const dataWithMAs = workingData.map((item, index, array) => {
        const shortSlice = array.slice(Math.max(0, index - shortMa + 1), index + 1);
        const longSlice = array.slice(Math.max(0, index - longMa + 1), index + 1);
        
        return {
            price_history: {
                ...item,
                date: item.date.toISOString().split('T')[0]
            },
            short_ma: shortSlice.length >= shortMa ? 
                shortSlice.reduce((sum, p) => sum + p.close, 0) / shortMa : null,
            long_ma: longSlice.length >= longMa ? 
                longSlice.reduce((sum, p) => sum + p.close, 0) / longMa : null
        };
    }).filter(item => item.price_history.date && item.short_ma !== null && item.long_ma !== null);

    // carlos
    // y ya de aquí tú le sigues
    // 1. Identificar señales de cruce
    const signals = [];
    let currentPosition = null; // null, 'buy' o 'sell'
    let entryPrice = 0;
    let stopLoss = 0;
    let takeProfit = 0;

    for (let i = 1; i < dataWithMAs.length; i++) {
        const prev = dataWithMAs[i-1];
        const current = dataWithMAs[i];
        
        // Detectar cruce alcista (compra)
        if (prev.short_ma < prev.long_ma && current.short_ma > current.long_ma) {
            if (currentPosition !== 'buy') {
                // Señal de compra
                entryPrice = current.price_history.close;
                stopLoss = findStopLoss('buy', dataWithMAs, i);
                takeProfit = entryPrice + (2 * (entryPrice - stopLoss)); // Relación 2:1
                
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
        // Detectar cruce bajista (venta)
        else if (prev.short_ma > prev.long_ma && current.short_ma < current.long_ma) {
            if (currentPosition !== 'sell') {
                // Señal de venta
                entryPrice = current.price_history.close;
                stopLoss = findStopLoss('sell', dataWithMAs, i);
                takeProfit = entryPrice - (2 * (stopLoss - entryPrice)); // Relación 2:1
                
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
        // Verificar si se activó stop-loss o take-profit
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

    // Calcular resultados finales si quedó posición abierta
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
        priceData: dataWithMAs,
        signals: signals
    };
}

// carlos
//esta la explicas tú
// Función auxiliar para calcular el stop-loss
function findStopLoss(type, data, currentIndex) {
    const lookback = 20; // Cantidad de días para buscar mínimos/máximos
    const startIndex = Math.max(0, currentIndex - lookback);
    const slice = data.slice(startIndex, currentIndex);
    
    if (type === 'buy') {
        // Para compras: stop-loss debajo del mínimo reciente
        const minLow = Math.min(...slice.map(d => d.price_history.low));
        return minLow * 0.99; // 1% debajo del mínimo
    } else {
        // Para ventas: stop-loss arriba del máximo reciente
        const maxHigh = Math.max(...slice.map(d => d.price_history.high));
        return maxHigh * 1.01; // 1% arriba del máximo
    }
}

//esta yo la explico - aramis
function parseSpecs(specsString) {
  const defaults = { short: 50, long: 200 };
  const result = { ...defaults };

  if (!specsString) return result;

  const validKeys = new Set(['short', 'long']);
  const minValues = { short: 5, long: 20 }; // Valores mínimos razonables

  specsString.split('&').forEach(part => {
    const [rawKey, value] = part.split(':');
    if (!rawKey || !value) return;
    
    const key = rawKey.trim().toLowerCase();
    const numValue = parseInt(value);
    
    if (validKeys.has(key) && !isNaN(numValue)) {
      result[key] = Math.max(minValues[key], numValue); // Asegurar valor mínimo
    }
  });

  return result;
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


module.exports = { GetAllPricesHistory, SimulateMACrossover, GetAllInvestmentStrategies };