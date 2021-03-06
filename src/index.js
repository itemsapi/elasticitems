const builder = require('./builder');
const searchHelper = require('./helpers/search');
const _ = require('lodash');
const bodybuilder = require('bodybuilder');

module.exports = function elasticitems(elastic_config, search_config) {

  search_config = search_config || {};

  const { Client } = require('@elastic/elasticsearch');
  const client = new Client({
    node: elastic_config.host
  });


  const build = async function(input, local_search_config) {
    input = input || {};
    input.per_page = input.per_page || 16;


    return builder.searchBuilder(input, local_search_config ||  search_config).build();
  }


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


    const qb = builder.searchBuilder(input, local_search_config ||  search_config);

    //console.log('start');
    //console.log(body.build());


    if (input.print_query) {
      console.log(JSON.stringify(qb.build(), null, 2));
    }

    const { body } = await client.search({
      index: input.index || elastic_config.index,
      track_total_hits: true,
      //type: input.type || elastic_config.type,
      body: qb.build()
    });

    //console.log(JSON.stringify(result.aggregations, null, 2));

    const output = searchHelper.searchConverter(input, local_search_config || search_config, body);

    return output;
  };

  const getBy = async function(key, value) {

    const qb = bodybuilder().size(5).query('term', key, {
      value: value,
    });

    const { body } = await client.search({
      index: elastic_config.index,
      body: qb.build(),
      _source: true
    });

    let result = body.hits.hits;
    result = result.length ? _.extend({
      id: result[0]._id
    }, result[0]._source) : null;
    return result;
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

    build: build,

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

        if (!search_config.aggregations[input.name]) {
          throw new Error('filter does not exist');
        }

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

    partialUpdate: async function(id, data, options) {

      options = options || {};

      const { body } = await client.update({
        index: elastic_config.index,
        id: id,
        refresh: options.refresh || false,
        body: {doc: data}
      });

      return body;
    },

    /**
     * add specific item
     */
    add: async function(data, options) {

      options = options || {};

      const result = await client.index({
        index: elastic_config.index,
        id: data.id,
        refresh: options.refresh || false,
        body: data
      });

      return result.body;
    },

    /**
     * delete specific item
     */
    delete: async function(id, options) {

      options = options || {};

      const { body } = await client.delete({
        index: elastic_config.index,
        id: id,
        refresh: options.refresh || false
      });

      return body;
    },

    /**
     * find specific item
     */
    get: async function(id) {
      const { body } = await client.get({
        index: elastic_config.index,
        id: id
      });

      return body._source;
    },

    getBy: getBy,

    similar: similar

  };
};
