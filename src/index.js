const builder = require('./builder');
const elasticsearch = require('elasticsearch');
const searchHelper = require('./helpers/search')();
const Promise = require('bluebird');

module.exports = function elasticitems(elastic_config, search_config) {

  search_config = search_config || {};

  var client = new elasticsearch.Client({
    host: elastic_config.host,
    defer: function () {
      return Promise.defer();
    }
  });

  return {

    /**
     * per_page
     * page
     * query
     * sort
     * filters
     */
    search: function(input, local_search_config) {
      input = input || {};
      input.per_page = input.per_page || 16;

      //console.log(search_config);
      var body = builder.searchBuilder(input, local_search_config || search_config)

      //console.log(body);
      //console.log(JSON.stringify(body, null, 2));

      return client.search({
        index: input.index || elastic_config.index,
        type: input.type || elastic_config.type,
        body: body
      })
      .then(result => {

        //console.log(result);
        //return r;
        return searchHelper.searchConverter(input, local_search_config || search_config, result);
      })
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

    similar: function() {

    },

    /**
     * returns list of elements for specific aggregation i.e. list of tags
     * name (aggregation name)
     * query
     * per_page
     * page
     */
    aggregation: function(input) {
    },

    /**
     * the same as aggregation
     */
    facet: function(input) {
    },

    /**
     * reindex items
     * reinitialize fulltext search
     */
    reindex: function(newItems) {
    },
  }
}
