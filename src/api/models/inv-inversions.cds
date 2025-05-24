namespace inv;

entity priceshistory{
    key ID:     Integer;
        DATE:   DateTime;
        OPEN:   Decimal;
        HIGH:   Decimal;
        LOW:    Decimal;
        CLOSE:  Decimal;
        VOLUME: Decimal;
   
};
entity pricehistoryinput2 {
    key ID          : Integer;
        DATE        : String;
        OPEN        : Decimal;
        HIGH        : Decimal;
        LOW         : Decimal;
        CLOSE       : Decimal;
        VOLUME      : Decimal;
    };
entity strategies{
    key ID          :Integer; 
        NAME        : String;
        DESCRIPTION : String;
        TIME        : Time;
        RISK        : Double;
};

// TIPO PARA SIMULACION
entity SIMULATION {
    key SIMULATIONID   : String;
        USERID         : String;
        STRATEGYID     : String;
        SIMULATIONNAME : String;
        SYMBOL         : String;
        STARTDATE      : Date;
        ENDDATE        : Date;
        AMOUNT         : Decimal(10, 2);
        SPECS          : array of INDICATOR;
        SIGNALS        : array of SIGNAL;
        SUMMARY        : SUMMARY;         // OBJETO DE RESUMEN
        CHART_DATA     : array of CHARTDATA; // DATOS PARA EL GRÁFICO
        DETAIL_ROW     : array of DETAILROW; // DETALLES DE REGISTRO
}

// TIPO PARA LAS SEÑALES DE COMPRA/VENTA
type SIGNAL {
    DATE      : Date;              // FORMATO "YYYY-MM-DD"
    TYPE      : String;
    PRICE     : Decimal(10, 2);
    REASONING : String;
    SHARES    : Decimal(18, 15);   // ALTA PRECISIÓN
}

// TIPO PARA EL OBJETO DE RESUMEN
type SUMMARY {
    TOTAL_BOUGHT_UNITS : Decimal(18, 4);
    TOTAL_SOLD_UNITS   : Decimal(18, 4);
    REMAINING_UNITS   : Decimal(18, 4);
    FINAL_CASH        : Decimal(10, 2);
    FINAL_VALUE       : Decimal(10, 2);
    FINAL_BALANCE     : Decimal(10, 2);
    REAL_PROFIT       : Decimal(10, 2);
    PERCENTAGE_RETURN : Decimal(18, 15); // ALTA PRECISIÓN
}

// TIPO PARA LOS DATOS DEL GRÁFICO
type CHARTDATA {
    DATE       : DateTime;           // FORMATO ISO 8601
    OPEN       : Decimal(10, 2);
    HIGH       : Decimal(10, 2);
    LOW        : Decimal(10, 2);
    CLOSE      : Decimal(10, 2);
    VOLUME     : Integer;
    INDICATORS : array of INDICATOR; // ARRAY DE INDICADORES
}

// TIPO PARA LOS INDICADORES DENTRO DE CHARTDATA
type INDICATOR {
    INDICATOR : String;
    VALUE     : Decimal(18, 15); // ALTA PRECISIÓN
}

// TIPO PARA EL DETALLE DE LA FILA (DETAIL_ROW)
type DETAILROW {
    ACTIVED        : Boolean;
    DELETED        : Boolean;
    DETAIL_ROW_REG : array of DETAILROWREG;
}

// TIPO PARA LOS REGISTROS DENTRO DE DETAIL_ROW_REG
type DETAILROWREG {
    CURRENT : Boolean;
    REGDATE : DateTime;
    REGTIME : String; // "HH:MM:SS"
    REGUSER : String;
}
