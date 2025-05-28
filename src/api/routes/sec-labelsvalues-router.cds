// src/routes/sec-labelsvalues-router.cds

using {sec as mysec} from '../models/sec-esecurity';  // Importar el modelo que contiene las entidades 'labels' y 'values'

@impl: 'src/api/controllers/sec-labelsvalues-controller.js'  // Implementación del controlador que maneja las operaciones de la API
service catalogos @(path:'/api/catalogos') {

    // Proyección de las entidades labels y values
    entity labels as projection on mysec.labels;
    entity label as projection on mysec.label;
    entity values as projection on mysec.values;
    entity value_ as projection on mysec.value;

    // Ruta para obtener todos los catálogos
    @Core.Description: 'Get all labels'
    @path: 'getAllLabels'
    function getAllLabels() 
    returns array of labels;

    // Ruta para crear un nuevo catálogo (POST)
    // @Core.Description: 'Create a new label'
    // @path: 'createLabel'
    // action createLabel(label: labels, type: Integer) 
    // returns array of labels;

    // Ruta para agregar un valor a un catálogo
    @Core.Description: 'd aAd value to a label'
    @path: 'createLabel'
    action createLabel(label: array of label, value: array of value_) 
    returns {
        success: Boolean;
        message: String;
        value: {};
    };

    // Ruta para actualizar un catálogo y un valor
    @Core.Description: 'Update a label and value'
    @path: 'updateLabel'
    action updateLabel(labels: array of label, values: array of value_)
    returns {
        success: Boolean;
        message: String;
        value: {};
    };

    // Ruta para eliminar un catálogo o un valor
    @Core.Description: 'Delete a label or value'
    @path: 'deleteLabelOrValue'
    function deleteLabelOrValue() 
    returns {
        success: Boolean;
        message: String;
        value: {};
    };
};
