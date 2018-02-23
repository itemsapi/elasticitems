const builder = require('./builder');
const elasticsearch = require('elasticsearch');
const searchHelper = require('./helpers/search');
const Promise = require('bluebird');
const _ = require('lodash');
const ejs = require('elastic.js');

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

  var getBy = function(key, value) {

    var body = ejs.Request()
    var query = ejs.TermQuery(key, value)
    body.query(query);

    return client.search({
      index: elastic_config.index,
      type: elastic_config.type,
      body: body,
      _source: true
    }).then(function(res) {
      var result = res.hits.hits;
      result = result.length ? _.extend({
        id: result[0]._id
      }, result[0]._source) : null;
      return result;
    });
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

      if (!input.name && !input.field) {
        return Promise.reject(new Error('Facet for given name doesn\'t exist or is incorrect'));
      }

      // creating local facet config and merging it with user input
      var facet_config = {};

      if (input.name) {
        facet_config = _.clone(search_config.aggregations[input.name]);
      }

      if (input.field) {
        facet_config.field = input.field;
        facet_config.type = 'terms';
      }

      facet_config.size = input.size;
      facet_config.sort = input.sort;
      facet_config.order = input.order;

      var key = input.name || input.field;

      // creating new lean search config only for single facet purpose
      var local_search_config = {
        aggregations: {
          [key]: facet_config
        }
      }

      if (input.filters && _.isString(input.filters)) {
        input.filters = JSON.parse(input.filters);
      }

      _.concat(_.keys(input.filters), _.keys(input.not_filters)).forEach(k => {
        // don't override already configured aggregation. only the rest
        if (k !== key) {
          local_search_config.aggregations[k] = search_config.aggregations[k];
        }
      })

      return search(input, local_search_config)
      .then(function(result) {
        return searchHelper.facetsConverter(input, local_search_config, result);
      })
      .then(function(result) {
        return _.find(result, {
          name: key
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
    delete: function(id, options) {

      options = options || {};

      return client.delete({
        index: elastic_config.index,
        type: elastic_config.type,
        id: id,
        refresh: options.refresh || false
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

    getBy: getBy,
    similar: similar,

    /**
     * reindex items
     * reinitialize fulltext search
     */
    reindex: function(newItems) {
    },
  }
}
