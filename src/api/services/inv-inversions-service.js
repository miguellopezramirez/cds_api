const axios = require('axios');
require('dotenv').config(); 

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
        const startDate = params?.startDate ? new Date(params.startDate) : null;
        const endDate = params?.endDate ? new Date(params.endDate) : null;
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

module.exports = { GetAllPricesHistory, SimulateMACrossover };