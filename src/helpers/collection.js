'use strict';
const _ = require('lodash');

module.exports = function(data) {

  data = data || {};

  const getSchema = function() {
    return data.schema || {};
  };

  const getExtraSchema = function() {
    return data.extraSchema || {};
  };

  const getFullSchema = function() {
    return _.merge(getExtraSchema(), getSchema());
  };

  const getName = function() {
    return data.name;
  };

  const getElasticSchema = function() {
    // omit non elasticsearch properties
    // elasticsearch 2.x is more strict about non elasticsearch properties
    return _.mapValues(getSchema(), function(val, ) {
      return _.omit(val, 'display');
    });
    /*return _.mapObject(getSchema(), function(val, key) {
      return _.pick(val, 'type', 'index', 'store')
    });*/
  };

  const getAggregations = function() {
    return data.aggregations || {};
  };

  /**
   * update aggregation on fly
   * by field, value or object with key value pairs
   */
  const updateAggregation = function(name, a, b) {
    if (_.isArray(data.aggregations)) {
      const index = _.findIndex(data.aggregations, {
        name: name
      });
      if (!data.aggregations[index]) {
        throw new Error('aggregation "' + name + '" doesnt exist');
      }
      data.aggregations[index][a] = b;
    } else {
      if (!data.aggregations[name]) {
        throw new Error('aggregation "' + name + '" doesnt exist');
      }
      data.aggregations[name][a] = b;
    }
  };

  /**
   * add aggregation on fly (by field)
   * by field, value or object with key value pairs
   */
  const addAggregation = function(name, obj) {
    if (_.isArray(data.aggregations)) {
      obj.name = name;

      const index = _.findIndex(data.aggregations, {
        name: name
      });
      if (!data.aggregations[index]) {
        data.aggregations.push(obj);
      } else {
        data.aggregations[index] = obj;
      }
    } else {
      data.aggregations[name] = obj;
    }
  };

  /**
   * be careful with using that
   * especially that aggretations is now as array or object
   */
  const getAggregation = function(name) {
    if (_.isArray(data.aggregations)) {
      return _.find(data.aggregations, {
        name: name
      });
    }
    return data.aggregations[name] || null;
  };

  const getSlugs = function() {
    return data.slugs || [];
  };

  const getSortings = function() {
    return data.sortings || {};
  };

  const getSorting = function(name) {
    return getSortings()[name] || null;
  };

  /**
   * defaults properties or property
   * i.e. sort
   */
  const getDefaults = function(option) {
    if (option) {
      return (data.defaults || {})[option];
    } else {
      return data.defaults || {};
    }
  };

  /**
   * default sorting option (key)
   */
  const getDefaultSorting = function() {
    return getSortings()[getDefaults('sort')] || null;
  };

  /**
   * chosen sorting key
   */
  const getChosenSortingKey = function(input) {
    if (getSorting(input)) {
      return input;
    } else if (getDefaultSorting()) {
      return getDefaults('sort');
    }
  };

  const enabledFieldDefaultValue = function(schema) {
    schema = schema || getExtraSchema();
    if (!schema.enabled || schema.enabled.default === false || schema.enabled.null_value === false) {
      return false;
    }
    return true;
  };

  const getCollection = function() {
    return data;
  };

  const getType = function() {
    return data.type || data.name;
  };

  const getIndex = function() {
    return data.index || data.project || getType();
  };

  const getMetadata = function() {
    const collection = data;
    return _.extend(_.clone(collection),
      {
        table: {
          fields: _.object(_.map(collection.table.fields, function(val, i) {
            let display = 'string';
            if (collection.schema[val] && collection.schema[val].display) {
              display = collection.schema[val].display;
            }
            return [val, {name: val, display: display, sort: i}];
          }))
        }
      }
    );
  };

  return {
    getSchema: getSchema,
    getExtraSchema: getExtraSchema,
    getFullSchema: getFullSchema,
    enabledFieldDefaultValue: enabledFieldDefaultValue,
    getName: getName,
    getDefaults: getDefaults,
    getDefaultSorting: getDefaultSorting,
    getChosenSortingKey: getChosenSortingKey,
    getElasticSchema: getElasticSchema,
    getAggregations: getAggregations,
    getAggregation: getAggregation,
    getSortings: getSortings,
    getSorting: getSorting,
    getType: getType,
    getIndex: getIndex,
    getSlugs: getSlugs,
    getMetadata: getMetadata,
    getCollection: getCollection,
    updateAggregation: updateAggregation,
    addAggregation: addAggregation
  };
};
