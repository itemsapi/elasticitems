const builder = require('./builder');
const elasticsearch = require('elasticsearch');

module.exports = function elasticitems(conf, configuration) {

  configuration = configuration || {};

  var client = new elasticsearch.Client({
    host: conf.host,
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
    search: function(input, collection) {
      input = input || {};

      var body = builder.searchBuilder(input, collection)

      //console.log(body);
      console.log(JSON.stringify(body, null, 2));

      return client.search({
        index: input.index,
        type: input.type,
        body: body,
      })
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

    /**
     * edit specific item
     */
    edit: function() {
    },

    /**
     * delete specific item
     */
    delete: function() {
    },

    /**
     * find specific item
     */
    findOne: function() {
    },
  }
}
