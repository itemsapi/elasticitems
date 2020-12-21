'use strict';

var ejs = require('elastic.js');
var collectionHelper = require('./helpers/collection');
var geoHelper = require('./helpers/geo');
var bodybuilder = require('bodybuilder')
var _ = require('lodash');

/**
 * ItemsAPI search builder
 */
exports.searchBuilder = function(query, config) {
  var page = query.page || 1;
  var per_page = query.per_page || 10;
  var offset = (page - 1) * per_page;
  var aggs = config.aggregations;
  var sortings = config.sortings;

  query = query || {};

  var filters = query.filters || {};
  var not_filters = query.not_filters || {};


  for (const [key, value] of Object.entries(aggs)) {

    if (!value.field) {
      throw new Error('field is missing');
    }
  }

  var qb = bodybuilder();


  qb.size(per_page)
  qb.from(offset);

  if (query.sort) {

    var field = sortings[query.sort].field;
    var order = sortings[query.sort].order;

    qb.sort(field, order);
  }

  //fulltextQuery.operator(data.operator || 'or');*/
  if (query.query) {
    qb.query('multi_match', {
      query: query.query,
      // @TODO rename field to query_fields
      fields: query.fields,
      // @TODO rename to query_operator
      operator: query.operator
    })
  }

  if (query.query_string) {
    qb.query('query_string', { query: query.query_string })
  }

  if (query.ids && Array.isArray(query.ids)) {
    qb.query('ids', { values: query.ids })
  }

  if (query.exclude_ids && Array.isArray(query.exclude_ids)) {
    qb.notQuery('ids', { values: query.exclude_ids })
  }


  /*var global_filter = bodybuilder().andFilter('bool', b => {

    for (const [key2, values2] of Object.entries(filters)) {
      for (const value2 of values2) {
        if (key !== key2) {
          b.andFilter('term', key2, value2);
        }
      }
    }

    return b;
  }).aggregation('terms', value.field, key, {size: value.size, missing: 'N/A'})*/

  /*qb.orFilter('term', 'tags', 'epic')
  qb.orFilter('term', 'tags', 'prison')

  return qb;*/

  // global filtering
  for (const [key, values] of Object.entries(filters)) {

    // dis OR con AND
    for (const value of values) {
      //qb.filter('term', key, value)

      //console.log(aggs[key]);

      if (aggs[key].conjunction === true) {
        qb.andFilter('term', aggs[key].field, value);
      } else {
        qb.orFilter('term', aggs[key].field, value);
      }
    }
  }

  for (const [key, values] of Object.entries(not_filters)) {
    for (const value of values) {
      qb.notFilter('term', aggs[key].field, value);
    }
  }

  // conjunctive facets
  for (const [key, value] of Object.entries(aggs)) {

    if (value.conjunction === true) {
      qb.aggregation('terms', value.field, key, {size: value.size})
    }
  }

  // disjunctive facets (global aggregations)
  qb.aggregation('global', {}, 'global', a => {


    // @TODO add global conjunction filter and query here

    for (const [key, value] of Object.entries(aggs)) {

      if (value.conjunction === false) {

        a.aggregation('filter', key, key, (b) => {

          // empty bool is slow
          return bodybuilder().andFilter('bool', b => {

            for (const [key2, values2] of Object.entries(filters)) {
              for (const value2 of values2) {
                if (key !== key2) {
                  b.andFilter('term', key2, value2);
                }
              }
            }

            return b;
          }).aggregation('terms', value.field, key, {size: value.size, missing: 'N/A'})
        })
      }
    }

    return a;
  })

  // no slow post filter

  return qb;
}
