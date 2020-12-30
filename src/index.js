const builder = require('./builder');
const elasticsearch = require('elasticsearch');
const searchHelper = require('./helpers/search');
const Promise = require('bluebird');
const _ = require('lodash');

module.exports = function elasticitems(elastic_config, search_config) {

  search_config = search_config || {};

  const client = new elasticsearch.Client({
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
  const search = async function(input, local_search_config) {
    input = input || {};
    input.per_page = input.per_page || 16;


    const body = builder.searchBuilder(input, local_search_config ||  search_config);

    //console.log('start');
    //console.log(body.build());
    //console.log(JSON.stringify(body.build(), null, 2));

    const result = await client.search({
      index: input.index || elastic_config.index,
      //type: input.type || elastic_config.type,
      body: body.build()
    });

    //console.log(JSON.stringify(result.aggregations, null, 2));

    const output = searchHelper.searchConverter(input, local_search_config || search_config, result);

    //console.log(output.data.aggregations);

    return output;
  };

  const getBy = function(key, value) {

    //const bodybuilder = require('bodybuilder');
    const ejs = require('elastic.js');
    const body = ejs.Request();
    const query = ejs.TermQuery(key, value);
    body.query(query);

    return client.search({
      index: elastic_config.index,
      //type: elastic_config.type,
      body: body,
      _source: true
    }).then(function(res) {
      let result = res.hits.hits;
      result = result.length ? _.extend({
        id: result[0]._id
      }, result[0]._source) : null;
      return result;
    });
  };

  const similar = function(id, input) {
    const query = {
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
    };

    if (input.query_string) {
      query.filtered.filter = {
        query: {
          query_string: {
            query: input.query_string
          }
        }
      };
    }

    const body = {
      query: query,
      //from: 0,
      //size: 5
    };

    return client.search({
      index: input.index || search_config.index,
      type: input.type || search_config.type,
      body: body
    })
      .then(function(result) {
        return searchHelper.similarConverter(input, result);
      });
  };

  return {

    search: search,

    /**
     * returns list of elements for specific aggregation i.e. list of tags
     * name (aggregation name)
     * query
     * per_page
     * page
     */
    aggregation: async function(input) {

      input = input || {};
      input.size = parseInt(input.size || 100);
      input.per_page = parseInt(input.per_page || 10);
      input.page = parseInt(input.page || 1);
      input.sort = input.sort || '_count';
      input.order = input.order || 'desc';

      if (!input.name && !input.field) {
        throw new Error('Facet for given name doesn\'t exist or is incorrect');
      }

      // creating local facet config and merging it with user input
      let facet_config = {};

      if (input.name) {
        facet_config = _.clone(search_config.aggregations[input.name]);
      }

      if (input.field) {
        facet_config.field = input.field;
        facet_config.type = 'terms';
      }

      facet_config.size = input.size || 10;
      facet_config.sort = input.sort;
      facet_config.order = input.order;

      if (input.conjunction !== undefined) {
        facet_config.conjunction = input.conjunction;
      }

      const key = input.name || input.field;

      // creating new lean search config only for single facet purpose
      const local_search_config = {
        aggregations: {
          [key]: facet_config
        }
      };

      if (input.filters && _.isString(input.filters)) {
        input.filters = JSON.parse(input.filters);
      }

      _.concat(_.keys(input.filters), _.keys(input.not_filters)).forEach(k => {
        // don't override already configured aggregation. only the rest
        if (k !== key) {
          local_search_config.aggregations[k] = search_config.aggregations[k];
        }
      });

      //console.log(input);
      //input.field = 'tags';
      //console.log(local_search_config);
      //console.log(key);

      //local_search_config.aggregations.tags.conjunction = true;

      let result = await search(input, local_search_config);
      result = searchHelper.facetsConverter(input, local_search_config, result);

      //console.log('before find');
      //console.log(key);
      //console.log(result);
      const res = _.find(result, {
        name: key
      });

      if (!res) {
        throw new Error('Facet for given name doesn\'t exist or is incorrect');
      }

      const output = searchHelper.processFacet(input, res);
      return output;
    },

    partialUpdate: function(id, data, options) {

      options = options || {};

      return client.update({
        index: elastic_config.index,
        //type: elastic_config.type,
        id: id,
        refresh: options.refresh || false,
        body: {doc: data}
      });
    },

    /**
     * add specific item
     */
    add: function(data, options) {

      options = options || {};

      return client.index({
        index: elastic_config.index,
        id: data.id,
        refresh: options.refresh || false,
        body: data
      });
    },

    /**
     * delete specific item
     */
    delete: function(id, options) {

      options = options || {};

      return client.delete({
        index: elastic_config.index,
        id: id,
        refresh: options.refresh || false
      });
    },

    /**
     * find specific item
     */
    get: function(id) {
      return client.get({
        index: elastic_config.index,
        //type: elastic_config.type,
        id: id
      })
        .then(result => {
          return result._source;
        });
    },
    getBy: getBy,
    similar: similar,
  };
};
