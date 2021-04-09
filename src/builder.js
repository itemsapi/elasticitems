'use strict';

//const collectionHelper = require('./helpers/collection');
//const geoHelper = require('./helpers/geo');
const bodybuilder = require('bodybuilder');
const _ = require('lodash');

/**
 * ItemsAPI search builder
 */
exports.searchBuilder = function(query, config) {
  const page = query.page || 1;
  const per_page = query.per_page || 10;
  const facets_names_obj = query.facets_names ? _.keyBy(query.facets_names) : null;

  //console.log(facets_names_obj);

  const offset = (page - 1) * per_page;
  const aggs = config.aggregations;
  const sortings = config.sortings;

  query = query || {};

  const filters = query.filters || {};
  const not_filters = query.not_filters || {};


  for (const [, value] of Object.entries(aggs)) {
    if (!value.field) {
      throw new Error('field is missing');
    }
  }

  const qb = bodybuilder();


  qb.size(per_page);
  qb.from(offset);

  //qb.filterMinimumShouldMatch(1, true);

  if (query.sort && sortings && sortings[query.sort]) {

    const field = sortings[query.sort].field;
    const order = sortings[query.sort].order;

    qb.sort(field, order);
  }

  // @TODO
  // make a functino for a query and filter to aggregations
  if (query.query) {
    qb.query('multi_match', {
      query: query.query,
      // @TODO rename field to query_fields
      fields: query.fields,
      // @TODO rename to query_operator
      operator: query.operator
    });
  }

  if (query.query_string) {
    qb.query('query_string', { query: query.query_string });
  }

  if (query.ids && Array.isArray(query.ids)) {
    qb.query('ids', { values: query.ids });
  }

  if (query.exclude_ids && Array.isArray(query.exclude_ids)) {
    qb.notQuery('ids', { values: query.exclude_ids });
  }

  // global filtering by filters
  // it filters all aggregations except global one
  for (const [key, values] of Object.entries(filters)) {

    if (!aggs[key]) {
      throw new Error('filter does not exist');
    }

    // disjunction terms
    if (aggs[key] && aggs[key].conjunction === false && aggs[key].type !== 'range') {
      qb.andFilter('bool', b => {

        for (const value of values) {
          b.orFilter('term', aggs[key].field, value);
        }
        return b;
      });
    }

    // disjunction range
    if (aggs[key] && aggs[key].conjunction === false && aggs[key].type === 'range') {
      qb.andFilter('bool', b => {

        for (const value of values) {
          const range = aggs[key].ranges.find(element => element.key === value);
          // https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-range-aggregation.html
          if (range) {
            b.orFilter('range', aggs[key].field, {
              gte: range.from,
              lt: range.to
            });
          }
        }

        return b;
      });
    }

    if (aggs[key] && aggs[key].conjunction !== false) {

      for (const value of values) {

        if (!aggs[key]) {
          throw new Error('filter does not exist');
        }

        if (aggs[key].type === 'range') {

          const range = aggs[key].ranges.find(element => element.key === value);

          // https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-range-aggregation.html
          if (range) {

            if (aggs[key].conjunction !== false) {
              qb.andFilter('range', aggs[key].field, {
                gte: range.from,
                lt: range.to
              });
            }
          }

        } else {

          if (aggs[key].conjunction !== false) {
            qb.andFilter('term', aggs[key].field, value);
          }
        }
      }
    }
  }

  for (const [key, values] of Object.entries(not_filters)) {
    for (const value of values) {

      if (aggs[key].type === 'range') {
        const range = aggs[key].ranges.find(element => element.key === value);
        if (range) {
          qb.notFilter('range', aggs[key].field, {
            gte: range.from,
            lt: range.to
          });
        }
      } else {
        qb.notFilter('term', aggs[key].field, value);
      }
    }
  }

  // conjunctive facets
  for (const [key, value] of Object.entries(aggs)) {

    if (value.conjunction !== false) {

      const options = {
        size: value.size
      };

      const order = value.order ? value.order : 'desc';

      if (value.sort) {

        const sort = value.sort === '_term' ? '_key' : value.sort;

        options.order = {
          [sort]: order
        };
      }

      if (facets_names_obj === null || facets_names_obj[key]) {
        if (value.type === 'range') {
          qb.aggregation('range', value.field, key, {
            ranges: value.ranges
          });
        } else {
          qb.aggregation('terms', value.field, key, options);
        }
      }
    }
  }

  // disjunctive facets (global aggregations)
  qb.aggregation('global', {}, 'global', a => {

    // @TODO add global conjunction filter and query here
    for (const [key, value] of Object.entries(aggs)) {

      if (value.conjunction === false) {

        if (facets_names_obj === null || facets_names_obj[key]) {

          a.aggregation('filter', key, key, () => {

            // empty bool is slow
            const filter = bodybuilder().andFilter('bool', b => {

              // disjunctive filters here

              for (const [key2, values2] of Object.entries(filters)) {

                // disjunction filters for terms
                if (aggs[key2] && aggs[key2].conjunction === false && aggs[key2].type !== 'range') {
                  b.andFilter('bool', c => {
                    if (key !== key2) {
                      for (const value2 of values2) {
                        c.orFilter('term', aggs[key2].field, value2);
                      }
                    }

                    return c;
                  });
                }

                // disjunction filters for range
                if (aggs[key2] && aggs[key2].conjunction === false && aggs[key2].type === 'range') {
                  b.andFilter('bool', c => {
                    if (key !== key2) {
                      for (const value2 of values2) {
                        const range = aggs[key2].ranges.find(element => element.key === value2);
                        if (range) {
                          c.orFilter('range', aggs[key2].field, {
                            gte: range.from,
                            lt: range.to
                          });
                        }
                      }
                    }

                    return c;
                  });
                }

                // conjunction filters
                if (aggs[key2] && aggs[key2].conjunction !== false) {
                  for (const value2 of values2) {
                    if (key !== key2) {

                      if (aggs[key2].type === 'range') {

                        const range = aggs[key2].ranges.find(element => element.key === value2);

                        if (range) {
                          if (aggs[key2].conjunction !== false) {
                            b.andFilter('range', aggs[key2].field, {
                              gte: range.from,
                              lt: range.to
                            });
                          }
                        }

                      } else {
                        if (aggs[key2].conjunction !== false) {
                          b.andFilter('term', aggs[key2].field, value2);
                        }
                      }
                    }
                  }
                }
              }



              return b;
            });

            const options = {
              size: value.size
            };

            const order = value.order ? value.order : 'desc';

            if (value.sort) {
              const sort = value.sort === '_term' ? '_key' : value.sort;

              options.order = {
                [sort]: order
              };
            }

            if (facets_names_obj === null || facets_names_obj[key]) {

              if (value.type === 'range') {
                filter.aggregation('range', value.field, key, {
                  ranges: value.ranges
                });
              } else {
                filter.aggregation('terms', value.field, key, options);
              }
            }

            /***
           * global filters copy
           */
            for (const [key, values] of Object.entries(not_filters)) {
              for (const value of values) {

                if (aggs[key].type === 'range') {
                  const range = aggs[key].ranges.find(element => element.key === value);
                  if (range) {
                    filter.notFilter('range', aggs[key].field, {
                      gte: range.from,
                      lt: range.to
                    });
                  }
                } else {
                  filter.notFilter('term', aggs[key].field, value);
                }
              }
            }

            /*
           * put it to helper function
           */
            if (query.query) {
              filter.filter('multi_match', {
                query: query.query,
                // @TODO rename field to query_fields
                fields: query.fields,
                // @TODO rename to query_operator
                operator: query.operator
              });
            }

            if (query.ids) {
              filter.filter('ids', { values: query.ids });
            }

            if (query.query_string) {
              filter.filter('query_string', { query: query.query_string });
            }

            if (query.exclude_ids && Array.isArray(query.exclude_ids)) {
              filter.notFilter('ids', { values: query.exclude_ids });
            }

            /***
           * global filters copy end
           */
            return filter;
          });
        }

      }
    }

    return a;
  });

  // no slow post filter
  //console.log(JSON.stringify(qb.build(), null, 2));
  return qb;
};
