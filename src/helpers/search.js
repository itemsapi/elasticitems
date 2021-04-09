'use strict';
const _ = require('lodash');
const collectionHelper = require('./collection');

const mergeInternalAggregations = function(aggregations) {
  _.forEach(_.keys(aggregations), function(key) {
    const index = key.indexOf('_internal_count');
    if (index !== -1) {
      const found_key = key.split('_internal_count')[0];

      if (aggregations[found_key] && aggregations[key]['value']) {
        aggregations[found_key]['total'] = aggregations[key]['value'];
      }
      delete aggregations[key];
    }
  });

  return aggregations;
};

const getAggregationsResponse = function(collection_aggs, result_aggs) {

  //console.log(result_aggs);
  //console.log(result_aggs.global);

  if (result_aggs.global && result_aggs.global.global_filterable) {

    for (const [key, value] of Object.entries(result_aggs.global.global_filterable)) {
      if (value && value[key] && value[key].buckets) {
        result_aggs[key] = value[key];
      }
    }

    delete result_aggs.global;
  }

  //console.log('error');
  //console.log(collection_aggs);
  //console.log(result_aggs);



  // object response
  return _.extend(_.clone(result_aggs), _.mapValues(result_aggs, function(v, k) {
    // supports filters in aggs
    if (!v.buckets && v[k]) {
      _.extend(v, v[k]);
      delete v[k];
    }

    v = _.omit(v, [
      'sum_other_doc_count',
      'doc_count_error_upper_bound',
      //'doc_count'
    ]);

    //console.log('ca');
    //console.log(collection_aggs);
    //console.log(k);

    return _.extend(v, {
      title: collection_aggs[k].title || k,
      name: k,
      position: parseInt(collection_aggs[k].position || 0, 10),
      size: parseInt(collection_aggs[k].size, 10),
      type: collection_aggs[k].type
    });
  }));
};

const getAggregationsFacetsResponse = function(collection_aggs, result_aggs) {
  let aggs = getAggregationsResponse(collection_aggs, result_aggs);

  aggs = _.chain(aggs)
    .filter({type: 'terms'})
    .map(function(val) {
    //console.log(val);
      return _.omit(val, ['sum_other_doc_count', 'doc_count_error_upper_bound']);
    })
    .map(function(val) {
      val.buckets = _.map(val.buckets, function(val2) {
        return val2;
      });
      return val;
    })
    .value();

  return aggs;
};

const facetsConverter = function(input, collection, result) {
  const helper = collectionHelper(collection);
  return getAggregationsFacetsResponse(
    helper.getAggregations(),
    result.data.aggregations
  );
};

const searchConverter = function(input, collection, data) {
  const helper = collectionHelper(collection);

  const items = _.map(data.hits.hits, function(doc) {
    return _.extend(
      {id: doc.id},
      doc._source, doc.fields
    );
  });

  //console.log(items);

  /*var sortings = _.mapValues(helper.getSortings(), function(v, k) {
    return {
      name: k,
      order: v.order,
      title: v.title
    };
  })*/

  return {
    meta: {
      query: input.query,
      //sort: helper.getChosenSortingKey(input.sort) || ''
    },
    pagination: {
      page: parseInt(input.page) || 1,
      per_page: parseInt(input.per_page) || 16,
      total: data.hits.total.value
    },
    data: {
      items: items,
      aggregations: getAggregationsResponse(
        helper.getAggregations(),
        data.aggregations
      )
    }
  };
};

const similarConverter = function(input, data) {

  //const helper = collectionHelper(input.collection);

  return {
    meta: {
      query: input.query,
      sort: input.sort
    },
    pagination: {
      page: parseInt(input.page) || 1,
      per_page: parseInt(input.per_page) || 16,
      total: data.hits.total
    },
    data: {
      items: _.map(data.hits.hits, function(doc) {
        return _.extend(
          {id: doc._id, score: doc._score},
          doc._source, doc.fields
        );
      })
    }
  };
};

const processFacet = function(input, facet) {

  const offset = input.per_page * (input.page - 1);

  facet.data = {
    buckets: _.chain(facet.buckets)
      .filter(v => {
        if (input.aggregation_query) {

          return v.key.toLowerCase().indexOf(
            input.aggregation_query.toLowerCase()
          ) === 0;
        }
        return true;
      })
      .value()
  };

  facet.pagination = {
    page: parseInt(input.page) || 1,
    per_page: parseInt(input.per_page) || 16,
    total: parseInt(facet.data.buckets.length)
  };

  facet.data.buckets = facet.data.buckets.slice(offset, offset + input.per_page);

  facet = _.omit(facet, [
    'doc_count',
    'size',
    'title',
    'name',
    'type',
    'buckets',
    'position'
  ]);
  return facet;
};

module.exports = {
  getAggregationsResponse: getAggregationsResponse,
  mergeInternalAggregations: mergeInternalAggregations,
  searchConverter: searchConverter,
  processFacet: processFacet,
  facetsConverter: facetsConverter,
  similarConverter: similarConverter
};

