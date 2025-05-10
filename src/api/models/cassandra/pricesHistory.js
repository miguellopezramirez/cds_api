// src/models/cassandra/pricesHistory.js
const { client } = require('../../../config/connectToCasssandra.config');

const PricesHistoryModel = {
  keyspace: 'db_esecurity',
  table: 'priceshistory',
  columns: {
    id: 'int',
    date: 'timestamp',
    open: 'decimal',
    high: 'decimal',
    low: 'decimal',
    close: 'decimal',
    volume: 'decimal'
  },

  // Método para obtener un registro por ID
  async getById(id) {
    const query = `
      SELECT * FROM ${this.keyspace}.${this.table}
      WHERE id = ?`;
    
    try {
      const result = await client.execute(query, [id], { prepare: true });
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error en PricesHistoryModel.getById:', error);
      throw error;
    }
  },

  // Método para obtener todos los registros (sin orden garantizado)
  async getAll(options = {}) {
    const { limit = 100 } = options;
    
    const query = `
      SELECT * FROM ${this.keyspace}.${this.table}
      LIMIT ?`;
    
    try {
      const result = await client.execute(query, [limit], { 
        prepare: true,
      });
      
      return {
        items: result.rows,
      };
    } catch (error) {
      console.error('Error en PricesHistoryModel.getAll:', error);
      throw error;
    }
  },

  // Método para buscar por rango de volumen
  async getByVolumeRange(minVolume, maxVolume, options = {}) {
    const { limit = 100 } = options;
    
    const query = `
      SELECT * FROM ${this.keyspace}.${this.table}
      WHERE volume >= ? AND volume <= ?
      LIMIT ? 
      ALLOW FILTERING`;
    
    try {
      const result = await client.execute(query, 
        [minVolume, maxVolume, limit], 
        { prepare: true }
      );
      
      return {
        items: result.rows,
      };
    } catch (error) {
      console.error('Error en PricesHistoryModel.getByVolumeRange:', error);
      throw error;
    }
  },

  // Método para inicializar la tabla
  async init() {
    const columnsDef = Object.entries(this.columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(', ');
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.table} (
        ${columnsDef},
        PRIMARY KEY (id)
      )`;
    
    await client.execute(query);
  },

    // Método para actualizar un registro existente
    async update(id, data) {
      try {
        const setClause = Object.keys(data)
          .map(key => `${key} = ?`)
          .join(', ');
  
        const query = `
          UPDATE ${this.keyspace}.${this.table}
          SET ${setClause}
          WHERE id = ?
        `;
  
        const params = [...Object.values(data), id];
  
        await client.execute(query, params, { prepare: true });
        return { success: true, message: 'Registro actualizado correctamente' };
      } catch (error) {
        console.error('Error en PricesHistoryModel.update:', error);
        throw error;
      }
    },

  // Agregar esto en PricesHistoryModel (justo después del método update)
  async deleteById(id) {
    const query = `
      DELETE FROM ${this.keyspace}.${this.table}
      WHERE id = ?`;
    
    try {
      await client.execute(query, [id], { prepare: true });
      return { success: true, message: 'Registro eliminado correctamente' };
    } catch (error) {
      console.error('Error en PricesHistoryModel.deleteById:', error);
      throw error;
    }
  },
  // Método para insertar múltiples registros
async insertMany(pricesArray) {
  if (!pricesArray || pricesArray.length === 0) {
    return [];
  }
  
  // Usamos batch para múltiples inserciones
  const queries = pricesArray.map(price => {
    const columns = Object.keys(price).join(', ');
    const placeholders = Object.keys(price).map(() => '?').join(', ');
    
    return {
      query: `INSERT INTO ${this.keyspace}.${this.table} (${columns}) VALUES (${placeholders})`,
      params: Object.values(price)
    };
  });
  
  try {
    await client.batch(queries, { prepare: true });
    return pricesArray; // Retornamos los datos insertados
  } catch (error) {
    console.error('Error en PricesHistoryModel.insertMany:', error);
    throw error;
  }
}
  
};




// Inicializamos la tabla al cargar el modelo
PricesHistoryModel.init();

module.exports = PricesHistoryModel;

