const assert = require('assert');
const ElasticItems = require('./../src/index');
const _ = require('lodash');
const movies_config = require('./fixtures/movies_config.json');
const movies_schema = require('./fixtures/movies_schema.json');
const movies = _.map(require('./fixtures/movies.json'), v => {
  return v;
});

const HOST = process.env.HOST || 'http://localhost:9205';
const INDEX = 'test';
const elasticbulk = require('elasticbulk');
//const elasticbulk = require('/home/mateusz/node/elasticbulk');

const elasticitems = ElasticItems({
  host: HOST,
  index: INDEX,
  type: INDEX,
}, movies_config);

const { Client } = require('@elastic/elasticsearch');
const elastic = new Client({
  node: HOST
});

describe('should search movies', function() {

  before(async function() {

    await elastic.indices.delete({
      index: INDEX,
      ignore_unavailable: true,
    });

    await elasticbulk.import(movies, {
      index: INDEX,
      host: HOST,
      refresh: true,
      debug: true,
      engine: 'elasticsearch7x',
    }, movies_schema);
  });

  describe('should search movies', function() {

    it('makes a simple search', async function() {

      const v = await elasticitems.search();

      assert.equal(20, v.pagination.total);
      assert.equal(16, v.pagination.per_page);
      assert.equal(1, v.pagination.page);
      assert.equal(16, v.data.items.length);

      //console.log(v.data.items[0]);
      assert.equal(undefined, v.data.items[0].score);

      //console.log(v.data.aggregations.rating);
      console.log(v.data.aggregations.rating_or);
      assert.equal(16, v.data.aggregations.rating_or.buckets[0].doc_count);
      assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal('8 - 9', v.data.aggregations.rating.buckets[0].key);
      assert.equal('8 - 9', v.data.aggregations.rating_or.buckets[0].key);
      assert.equal(4, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(92, v.data.aggregations.tags.buckets.length);
      assert.equal('Tags', v.data.aggregations.tags.title);
      assert.equal(262, v.data.aggregations.actors.buckets.length);
      assert.equal(262, v.data.aggregations.actors_or.buckets.length);
    });

    it('should makes a full text search', async function() {

      const v = await elasticitems.search({
        query: 'redemption shawshank aaa'
      });

      assert.equal(3, v.pagination.total);
      assert.equal('The Shawshank Redemption', v.data.items[0].name);
    });

    it('should makes a full text search within keyword type', async function() {

      const v = await elasticitems.search({
        query: 'biography'
      });

      assert.equal(3, v.pagination.total);
    });

    it('should makes a full text search', async function() {

      const v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'redemption shawshank'
      });

      assert.equal(1, v.pagination.total);
      assert.equal('The Shawshank Redemption', v.data.items[0].name);
      assert.equal(5, v.data.aggregations.tags.buckets.length);
      assert.equal(5, v.data.aggregations.tags_or.buckets.length);
    });

    xit('should makes a full text search with fuziness', async function() {

      const v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        operator: 'and',
        query: 'imprisoned numbers',
        fuziness: 1.0,
        fields: ['description']
      });

      assert.equal(1, v.pagination.total);
    });

    it('should makes a full text search over specific fields', async function() {

      let v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['description']
      });

      assert.equal(1, v.pagination.total);

      v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['name', 'description']
      });

      assert.equal(1, v.pagination.total);

      v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['name']
      });

      assert.equal(0, v.pagination.total);
      assert.equal(0, v.data.aggregations.country.buckets.length);
    });

    it('should makes a full text search and search by ids', async function() {

      const v = await elasticitems.search({
        ids: ['1']
      });

      assert.equal(1, v.pagination.total);
      assert.equal(5, v.data.aggregations.tags.buckets.length);
      assert.equal(5, v.data.aggregations.tags_or.buckets.length);

      assert.equal(0, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(1, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal('9 - 10', v.data.aggregations.rating.buckets[1].key);
    });

    it('should makes a full text search and search by ids', async function() {

      let v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['description'],
        ids: ['2']
      });

      assert.equal(0, v.pagination.total);

      v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['description'],
        exclude_ids: ['2']
      });

      assert.equal(1, v.pagination.total);

      v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'imprisoned number years',
        fields: ['description'],
        exclude_ids: ['1']
      });

      assert.equal(0, v.pagination.total);

      v = await elasticitems.search({
        ids: ['1', '2']
      });

      assert.equal(2, v.pagination.total);

      v = await elasticitems.search({
        ids: ['1', '2'],
        exclude_ids: ['2']
      });

      assert.equal(1, v.pagination.total);

      assert.equal('USA', v.data.aggregations.country.buckets[0].key);
      assert.equal(1, v.data.aggregations.country.buckets[0].doc_count);
    });

    it('should makes a full text search with and | or operator', async function() {

      let v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        query: 'redemption shawshank wordword'
      });

      assert.equal(1, v.pagination.total);

      v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3',
        operator: 'and',
        query: 'redemption shawshank wordword'
      });

      assert.equal(0, v.pagination.total);
      assert.equal(0, v.data.aggregations.country.buckets.length);
    });

    it('should search with query_string', async function() {

      const v = await elasticitems.search({
        query_string: 'rating:<=9.3 AND rating:>=9.3'
      });

      assert.equal(1, v.pagination.total);
      assert.equal('The Shawshank Redemption', v.data.items[0].name);

      assert.equal('USA', v.data.aggregations.country.buckets[0].key);
      assert.equal(1, v.data.aggregations.country.buckets[0].doc_count);
    });


    it('makes a simple sort', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        sort: 'name'
      });
      assert.equal('12 Angry Men', v.data.items[0].name);
    });




    it('makes a simple facet filtering', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        filters: {
          tags: ['epic', 'middle earth']
        }
      });
      assert.equal(2, v.pagination.total);
      assert.equal(7, v.data.aggregations.tags.buckets.length);

      //assert.equal('New Zealand', v.data.aggregations.country.buckets[0].key);
      //assert.equal(2, v.data.aggregations.country.buckets[0].doc_count);
      //assert.equal('USA', v.data.aggregations.country.buckets[1].key);
      //assert.equal(2, v.data.aggregations.country.buckets[1].doc_count);

    });

    it('makes a simple facet filtering only for a given facets name', async function() {

      let v = await elasticitems.search({
        per_page: 1,
        facets_names: ['tags']
      });
      assert.equal(20, v.pagination.total);
      assert.deepEqual(['tags'], Object.keys(v.data.aggregations));

      v = await elasticitems.search({
        per_page: 1,
        facets_names: ['tags', 'rating_or']
      });
      assert.equal(20, v.pagination.total);
      assert.deepEqual(['tags', 'rating_or'], Object.keys(v.data.aggregations));
    });

    it('makes a simple facet filtering with or (disjunctive)', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        filters: {
          tags_or: ['epic']
        }
      });

      assert.equal(2, v.pagination.total);
      assert.equal(92, v.data.aggregations.tags_or.buckets.length);

      assert.equal('New Zealand', v.data.aggregations.country.buckets[0].key);
      assert.equal(2, v.data.aggregations.country.buckets[0].doc_count);
      assert.equal('USA', v.data.aggregations.country.buckets[1].key);
      assert.equal(2, v.data.aggregations.country.buckets[1].doc_count);
    });

    it('makes a simple facet filtering with or (disjunctive)', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        filters: {
          tags_or: ['epic', '1950s']
        }
      });

      assert.equal(3, v.pagination.total);
      assert.equal(92, v.data.aggregations.tags_or.buckets.length);

      console.log(v.data.aggregations.country);

      assert.equal('USA', v.data.aggregations.country.buckets[0].key);
      assert.equal(3, v.data.aggregations.country.buckets[0].doc_count);
      assert.equal('New Zealand', v.data.aggregations.country.buckets[1].key);
      assert.equal(2, v.data.aggregations.country.buckets[1].doc_count);
    });

    it('makes a simple facet filtering using NOT ', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        not_filters: {
          tags: ['epic', '1950s']
        }
      });

      assert.equal(17, v.pagination.total);
      // elasticitems
      assert.equal(83, v.data.aggregations.tags_or.buckets.length);
      // itemsapi (bug)
      //assert.equal(92, v.data.aggregations.tags_or.buckets.length)

      assert.equal('USA', v.data.aggregations.country.buckets[0].key);
      assert.equal(16, v.data.aggregations.country.buckets[0].doc_count);
      assert.equal('UK', v.data.aggregations.country.buckets[1].key);
      assert.equal(2, v.data.aggregations.country.buckets[1].doc_count);
    });

    it('makes a simple facet filtering on raw field', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        filters: {
          genres_or: ['Drama']
        }
      });

      assert.equal(15, v.pagination.total);
      assert.equal(67, v.data.aggregations.tags.buckets.length);
      assert.equal(2, v.data.aggregations.rating_or.buckets.length);
    });



    it('makes a simple facet filtering on two names', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        facets_names: ['tags_or', 'actors_or'],
        filters: {
          tags_or: ['mafia'],
          actors_or: ['Al Pacino']
        }
      });

      //console.log(v.data.aggregations);
      console.log(v);

      assert.equal(2, v.pagination.total);
      assert.equal(9, v.data.aggregations.tags_or.buckets.length);
      assert.equal(38, v.data.aggregations.actors_or.buckets.length);
    });

    it('makes a simple facet filtering on no names', async function() {

      const v = await elasticitems.search({
        per_page: 1,
        facets_names: [],
        filters: {
          tags_or: ['mafia'],
          actors_or: ['Al Pacino']
        }
      });

      assert.equal(2, v.pagination.total);
    });

    it('makes a simple facet filtering with ranges', async function() {

      let v = await elasticitems.search({
        per_page: 1,
        filters: {
          rating: ['8 - 9']
        }
      });

      assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(0, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(16, v.pagination.total);

      v = await elasticitems.search({
        per_page: 1,
        filters: {
          rating: ['9 - 10']
        }
      });

      assert.equal(0, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(4, v.pagination.total);

      v = await elasticitems.search({
        per_page: 1,
        not_filters: {
          rating: ['9 - 10']
        }
      });

      assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(0, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(16, v.pagination.total);

      v = await elasticitems.search({
        per_page: 1,
        not_filters: {
          rating: ['8 - 9', '9 - 10']
        }
      });

      assert.equal(0, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(0, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(0, v.pagination.total);
    });

    it('makes a simple facet filtering with disjunctive ranges', async function() {

      let v = await elasticitems.search({
        per_page: 1,
        filters: {
          rating_or: ['8 - 9']
        }
      });

      //console.log(v.data.aggregations.rating);

      assert.equal(16, v.data.aggregations.rating_or.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating_or.buckets[1].doc_count);

      assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(0, v.data.aggregations.rating.buckets[1].doc_count);
      assert.equal(16, v.pagination.total);

      v = await elasticitems.search({
        per_page: 1,
        filters: {
          rating_or: ['9 - 10']
        }
      });

      assert.equal(16, v.data.aggregations.rating_or.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating_or.buckets[1].doc_count);

      assert.equal(0, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating.buckets[1].doc_count);

      assert.equal(2, v.data.aggregations.tags.buckets[0].doc_count);
      assert.equal('mafia', v.data.aggregations.tags.buckets[0].key);

      assert.equal(2, v.data.aggregations.tags_or.buckets[0].doc_count);
      assert.equal('mafia', v.data.aggregations.tags_or.buckets[0].key);

      assert.equal(4, v.pagination.total);

      v = await elasticitems.search({
        per_page: 1,
        filters: {
          rating_or: ['8 - 9', '9 - 10']
        }
      });

      assert.equal(16, v.data.aggregations.rating_or.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating_or.buckets[1].doc_count);

      assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count);
      assert.equal(4, v.data.aggregations.rating.buckets[1].doc_count);

      assert.equal(3, v.data.aggregations.tags.buckets[0].doc_count);
      assert.equal('mafia', v.data.aggregations.tags.buckets[0].key);

      assert.equal(3, v.data.aggregations.tags_or.buckets[0].doc_count);
      assert.equal('mafia', v.data.aggregations.tags_or.buckets[0].key);

      assert.equal(20, v.pagination.total);
    });

  });

  describe('makes single facet query', function() {

    it('should make single facet query on movies with size', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        size: 30,
        per_page: 5
      });

      assert.equal(5, v.data.buckets.length);
      assert.equal('mafia', v.data.buckets[0].key);
      assert.equal(3, v.data.buckets[0].doc_count);
      assert.equal(5, v.pagination.per_page);
      assert.equal(30, v.pagination.total);
    });

    it('should make single facet query on movies with filters', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        filters: {
          tags: ['mafia'],
          genres: ['Biography']
        },
        size: 30,
        per_page: 5
      });

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with not filters', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        filters: {
          tags: ['mafia'],
        },
        not_filters: {
          genres: ['Biography']
        },
        size: 30,
        per_page: 5
      });

      assert.equal(9, v.pagination.total);
    });

    it('should make single facet query on movies with search query', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        query: 'biography',
        filters: {
          tags: ['mafia'],
        },
        size: 30,
        per_page: 5
      });

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with search query_string', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        query_string: 'biography AND mafia',
        filters: {
          tags: ['mafia'],
        },
        size: 30,
        per_page: 5
      });

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with aggregation_query', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        aggregation_query: 'ma',
        per_page: 5
      });

      assert.equal(1, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(1, v.pagination.total);

    });

    it('should make single facet query on movies with alphabetical sorting', async function() {

      const v = await elasticitems.aggregation({
        name: 'tags',
        order: 'desc',
        sort: '_key'
      });

      assert.equal('wrongful imprisonment', v.data.buckets[0].key);
      assert.equal(1, v.data.buckets[0].doc_count);
    });

    it('should make single facet query on movies with field param', async function() {

      const v = await elasticitems.aggregation({
        field: 'tags',
        order: 'desc',
        sort: '_key'
      });

      assert.equal('wrongful imprisonment', v.data.buckets[0].key);
      assert.equal(1, v.data.buckets[0].doc_count);
    });

    it('should make single facet query on movies with field param', async function() {

      const v = await elasticitems.aggregation({
        field: 'genres.raw',
        order: 'asc',
        conjunction: true,
        sort: '_term'
      });

      assert.equal(6, v.data.buckets[0].doc_count);
      assert.equal('Action', v.data.buckets[0].key);
    });

    it('should make single facet query on movies with field param', async function() {

      const v = await elasticitems.aggregation({
        name: 'genres',
        order: 'asc',
        conjunction: true,
        sort: '_term'
      });

      assert.equal(6, v.data.buckets[0].doc_count);
      assert.equal('Action', v.data.buckets[0].key);
    });

    it('should throw an error for not existing facet', async function() {

      await assert.rejects(
        async () => {
          await elasticitems.aggregation();
        },
        {
          name: 'Error',
          //message: 'Wrong value'
        }
      );
    });

    it('should throw an error for not existing facet', async function() {

      await assert.rejects(
        async () => {
          await elasticitems.aggregation({
            name: 'blabla'
          });
        },
        {
          name: 'TypeError',
          //message: 'Wrong value'
        }
      );
    });
  });
});
