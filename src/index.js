const builder = require('./builder');
const elasticsearch = require('elasticsearch');
const searchHelper = require('./helpers/search');
const Promise = require('bluebird');
const _ = require('lodash');

module.exports = function elasticitems(elastic_config, search_config) {

  search_config = search_config || {};

  var client = new elasticsearch.Client({
    host: elastic_config.host,
    defer: function () {
      return Promise.defer();
    }
  });

  /**
   * per_page
   * page
   * query
   * sort
   * filters
   */
  var search = function(input, local_search_config) {
    input = input || {};
    input.per_page = input.per_page || 16;

    var body = builder.searchBuilder(input, local_search_config || search_config)

    return client.search({
      index: input.index || elastic_config.index,
      type: input.type || elastic_config.type,
      body: body
    })
    .then(result => {
      return searchHelper.searchConverter(input, local_search_config || search_config, result);
    })
  }

  var similar = function(id, input) {
    var query = {
      filtered: {
        query: {
          mlt: {
            fields: input.fields,
            ids: [id],
            min_doc_freq: 0,
            min_term_freq: 0
          }
        }
      }
    }

    if (input.query_string) {
      query.filtered.filter = {
        query: {
          query_string: {
            query: input.query_string
          }
        }
      }
    }

    var body = {
      query: query,
      //from: 0,
      //size: 5
    }

    return client.search({
      index: input.index || search_config.index,
      type: input.type || search_config.type,
      body: body
    })
    .then(function(result) {
      return searchHelper.similarConverter(input, result);
    })
  }

  return {

    search: search,

    /**
     * returns list of elements for specific aggregation i.e. list of tags
     * name (aggregation name)
     * query
     * per_page
     * page
     */
    aggregation: function(input) {

      input = input || {};
      input.size = parseInt(input.size || 100)
      input.per_page = parseInt(input.per_page || 10)
      input.page = parseInt(input.page || 1)
      input.sort = input.sort || '_count'
      input.order = input.order || 'desc'

      if (!input.name) {
        return Promise.reject(new Error('Facet for given name doesn\'t exist or is incorrect'));
      }

      // not supported yet
      /*if (input.filter && _.isString(input.filter)) {
        input.filter = JSON.parse(input.filter)
      }*/

      // creating local facet config and merging it with user input
      var facet_config = search_config.aggregations[input.name];
      facet_config.size = input.size;
      facet_config.sort = input.sort;
      facet_config.order = input.order;

      // creating new lean search config only for single facet purpose
      var local_search_config = {
        aggregations: {
          [input.name]: facet_config
        }
      }

      return search(input, local_search_config)
      .then(function(result) {
        return searchHelper.facetsConverter(input, local_search_config, result);
      })
      .then(function(result) {
        return _.find(result, {
          name: input.name
        })
      })
      .then(function(res) {
        if (!res) {
          throw new Error('Facet for given name doesn\'t exist or is incorrect');
        }

        return searchHelper.processFacet(input, res);
      })
    },

    /**
     * the same as aggregation
     */
    facet: function(input) {
    },

    partialUpdate: function(id, data, options) {

      options = options || {};

      return client.update({
        index: elastic_config.index,
        type: elastic_config.type,
        id: id,
        refresh: options.refresh || false,
        body: {doc: data}
      })
    },

    /**
     * add specific item
     */
    add: function(data, options) {

      options = options || {};

      return client.index({
        index: elastic_config.index,
        type: elastic_config.type,
        id: data.id,
        refresh: options.refresh || false,
        //body: data.body
        body: data
      })
    },

    /**
     * delete specific item
     */
    delete: function(id) {

      return client.delete({
        index: elastic_config.index,
        type: elastic_config.type,
        id: id
      })
    },

    /**
     * find specific item
     */
    get: function(id) {
      return client.get({
        index: elastic_config.index,
        type: elastic_config.type,
        id: id
      })
      .then(result => {
        return result._source;
      })
    },

    similar: similar,

    /**
     * reindex items
     * reinitialize fulltext search
     */
    reindex: function(newItems) {
    },
  }
}
