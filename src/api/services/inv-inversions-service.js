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

async function SimulateMACrossover(params) { 
    try {
        const symbol = params?.symbol || 'AAPL';
        const startDate = params?.start_date ? new Date(params.start_date) : null;
        const endDate = params?.end_date ? new Date(params.end_date) : null;
        const shortMa = params?.short_ma || 50; // Media Móvil Corta
        const longMa = params?.long_ma || 200; // Media Móvil Larga
    
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

        const workingData = calculateMovingAverageData(history, startDate, endDate, shortMa,longMa);
        const result = {
            idSimulation: `${symbol}_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`,
            signal: 'golden_cross', 
            start_date: startDate?.toISOString().split('T')[0] || 'auto',
            end_date: endDate?.toISOString().split('T')[0] || 'auto',
            moving_avegages: { short: shortMa, long: longMa },
            signals: [],
            chart_data: workingData,
            result: 0
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
    return workingData.map((item, index, array) => {
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