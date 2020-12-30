'use strict';
var _ = require('lodash');
var collectionHelper = require('./collection');
var slug = require('slug')

var mergeInternalAggregations = function(aggregations) {
  _.forEach(_.keys(aggregations), function(key) {
    var index = key.indexOf('_internal_count')
    if (index !== -1) {
      var found_key = key.split('_internal_count')[0]

      if (aggregations[found_key] && aggregations[key]['value']) {
        aggregations[found_key]['total'] = aggregations[key]['value']
      }
      delete aggregations[key]
    }
  })

  return aggregations
}

var getAggregationsResponse = function(collection_aggs, result_aggs) {

  //console.log(result_aggs);
  //console.log(result_aggs.global);

  if (result_aggs.global) {

    for (const [key, value] of Object.entries(result_aggs.global)) {
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
    ])

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
  }))
}

var getAggregationsFacetsResponse = function(collection_aggs, result_aggs) {
  var aggs = getAggregationsResponse(collection_aggs, result_aggs);

  aggs = _.chain(aggs)
  .filter({type: 'terms'})
  .map(function(val) {
    //console.log(val);
    return _.omit(val, ['sum_other_doc_count', 'doc_count_error_upper_bound'])
  })
  .map(function(val) {
    val.buckets = _.map(val.buckets, function(val2) {
      //val2.permalink = slug(val2.key, {lower: true});
      return val2;
    })
    return val;
  })
  .value();

  return aggs;
}

var facetsConverter = function(input, collection, result) {
  var helper = collectionHelper(collection);
  return getAggregationsFacetsResponse(
    helper.getAggregations(),
    result.data.aggregations
  )
}

var searchConverter = function(input, collection, data) {
  var helper = collectionHelper(collection);

  var items = _.map(data.hits.hits, function(doc) {
    return _.extend(
      {id: doc.id},
      doc._source, doc.fields
    );
  })

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
  }
}

var similarConverter = function(input, data) {
  var helper = collectionHelper(input.collection);
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
  }
}

var processFacet = function(input, facet) {

  var offset = input.per_page * (input.page - 1)

  facet.data = {
    buckets: _.chain(facet.buckets)
    .filter(v => {
      if (input.aggregation_query) {

        return v.key.toLowerCase().indexOf(
          input.aggregation_query.toLowerCase()
        ) === 0
      }
      return true
    })
    .value()
  }

  facet.pagination = {
    page: parseInt(input.page) || 1,
    per_page: parseInt(input.per_page) || 16,
    total: parseInt(facet.data.buckets.length)
  }

  facet.data.buckets = facet.data.buckets.slice(offset, offset + input.per_page);

  facet = _.omit(facet, [
    'doc_count',
    'size',
    'title',
    'name',
    'type',
    'buckets',
    'position'
  ])
  return facet
}

module.exports = {
  getAggregationsResponse: getAggregationsResponse,
  mergeInternalAggregations: mergeInternalAggregations,
  searchConverter: searchConverter,
  processFacet: processFacet,
  facetsConverter: facetsConverter,
  similarConverter: similarConverter
}

