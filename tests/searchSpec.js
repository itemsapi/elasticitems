var assert = require('assert');
var should = require('should');
var sinon = require('sinon');
var searchHelper = require('./../src/helpers/search');
var ElasticItems = require('./../src/index');
var elastic;
var elasticitems;
var search_config = require('./fixtures/movies-collection.json');
var movies = require('./fixtures/movies.json');
var HOST = process.env.HOST || 'http://127.0.0.1:9200';
var INDEX = 'test';
const elasticsearch = require('elasticsearch');
const Promise = require('bluebird');
const elasticbulk = require('elasticbulk');

describe('should search movies', function() {

  before(async function() {

    elasticitems = ElasticItems({
      host: HOST,
      index: INDEX,
      type: INDEX,
    }, search_config);

    elastic = new elasticsearch.Client({
      host: HOST,
      defer: function () {
        return Promise.defer();
      }
    });

    await elastic.indices.delete({
      index: INDEX
    })
    .catch(v => {
    })

    await elasticbulk.import(movies, {
      index: INDEX,
      host: HOST
    }, search_config.schema)
    .delay(1000)
  })

  describe('should search movies', function() {

    it('makes a simple search', function(done) {

      elasticitems.search()
      .then(v => {
        //console.log(v.data.items);
        assert.equal(20, v.pagination.total)
        assert.equal(16, v.pagination.per_page)
        assert.equal(1, v.pagination.page)
        assert.equal(16, v.data.items.length)

        //console.log(v.data.items[0]);
        assert.equal(undefined, v.data.items[0].score)

        //console.log(v.data.aggregations.rating);
        assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count)
        assert.equal('8 - 9', v.data.aggregations.rating.buckets[0].key)
        assert.equal(4, v.data.aggregations.rating.buckets[1].doc_count)
        //assert.equal(undefined, v.data.aggregations.tags.doc_count)
        assert.equal(92, v.data.aggregations.tags.buckets.length)
        assert.equal('Tags', v.data.aggregations.tags.title)
        assert.equal(262, v.data.aggregations.actors.buckets.length)
        assert.equal(262, v.data.aggregations.actors_or.buckets.length)
        done();
      })
    });

    it('makes a simple sort', function(done) {

      elasticitems.search({
        per_page: 1,
        sort: 'name'
      })
      .then(v => {
        assert.equal('12 Angry Men', v.data.items[0].name)
        done();
      })
    });

    it('makes a simple facet filtering', function(done) {

      elasticitems.search({
        per_page: 1,
        filters: {
          tags: ['epic', 'middle earth']
        }
      })
      .then(v => {
        assert.equal(2, v.pagination.total)
        assert.equal(7, v.data.aggregations.tags.buckets.length)
        done();
      })
    });

    it('makes a simple facet filtering with or (disjunctive)', function(done) {

      elasticitems.search({
        per_page: 1,
        filters: {
          tags_or: ['epic', '1950s']
        }
      })
      .then(v => {
        assert.equal(3, v.pagination.total)
        assert.equal(92, v.data.aggregations.tags_or.buckets.length)
        done();
      })
    });

    it('makes a simple facet filtering using NOT ', function(done) {

      elasticitems.search({
        per_page: 1,
        not_filters: {
          tags: ['epic', '1950s']
        }
      })
      .then(v => {
        assert.equal(17, v.pagination.total)
        assert.equal(83, v.data.aggregations.tags_or.buckets.length)
        done();
      })
    });

    it('makes a simple facet filtering with ranges', function(done) {

      elasticitems.search({
        per_page: 1,
        filters: {
          rating: ['8 - 9']
        }
      })
      .then(v => {
        assert.equal(16, v.data.aggregations.rating.buckets[0].doc_count)
        done();
      })
    });

    xit('makes a simple facet filtering using is empty facet', function(done) {

      elasticitems.search({
        per_page: 1,
        /*filters: {
          empty_tags: ['epic', '1950s']
          }*/
        })
      .then(v => {
        console.log(v.data.aggregations.empty_tags);
        //assert.equal(17, v.pagination.total)
        //assert.equal(83, v.data.aggregations.empty_tags)
        done();
        })
      });
  });

  describe('makes single facet query', function() {

    it('should make single facet query on movies', async function() {

      var spy = sinon.spy(searchHelper, 'facetsConverter');

      var v = await elasticitems.aggregation({
        name: 'tags',
        //size: 30,
        per_page: 5
      })

      assert.equal('mafia', v.data.buckets[0].key);
      assert.equal(3, v.data.buckets[0].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(92, v.pagination.total);
      assert.equal(spy.callCount, 1);
      assert.equal(92, spy.firstCall.args[2].data.aggregations.tags.buckets.length);
      assert.equal('tags', spy.firstCall.args[1].aggregations.tags.field);
      assert.equal(3, spy.firstCall.args.length);
      spy.restore();

    });

    it('should make single facet query on movies with size', async function() {

      var v = await elasticitems.aggregation({
        name: 'tags',
        size: 30,
        per_page: 5
      })

      assert.equal(5, v.data.buckets.length);
      assert.equal('mafia', v.data.buckets[0].key);
      assert.equal(3, v.data.buckets[0].doc_count);
      assert.equal(5, v.pagination.per_page);
      assert.equal(30, v.pagination.total);
    });

    it('should make single facet query on movies with filters', async function() {

      var v = await elasticitems.aggregation({
        name: 'tags',
        filters: {
          tags: ['mafia'],
          genres: ['Biography']
        },
        size: 30,
        per_page: 5
      })

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with search query', async function() {

      var v = await elasticitems.aggregation({
        name: 'tags',
        query: 'biography',
        filters: {
          tags: ['mafia'],
        },
        size: 30,
        per_page: 5
      })

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with search query_string', async function() {

      var v = await elasticitems.aggregation({
        name: 'tags',
        query_string: 'biography AND mafia',
        filters: {
          tags: ['mafia'],
        },
        size: 30,
        per_page: 5
      })

      assert.equal('mafia', v.data.buckets[2].key);
      assert.equal(1, v.data.buckets[2].doc_count);
      assert.equal(5, v.data.buckets.length);
      assert.equal(5, v.pagination.per_page);
      assert.equal(5, v.pagination.total);
    });

    it('should make single facet query on movies with aggregation_query', function(done) {

      elasticitems.aggregation({
        name: 'tags',
        aggregation_query: 'ma',
        per_page: 5
      })
      .then(v => {
        assert.equal(1, v.data.buckets.length);
        assert.equal(5, v.pagination.per_page);
        assert.equal(1, v.pagination.total);
        done();
      })
    });

    it('should make single facet query on movies with alphabetical sorting', function(done) {

      elasticitems.aggregation({
        name: 'tags',
        order: 'desc',
        sort: '_term'
      })
      .then(v => {
        assert.equal('wrongful imprisonment', v.data.buckets[0].key);
        assert.equal(1, v.data.buckets[0].doc_count);
        done();
      })
    });

    it('should make single facet query on movies with field param', function(done) {

      elasticitems.aggregation({
        field: 'tags',
        order: 'desc',
        sort: '_term'
      })
      .then(v => {
        assert.equal('wrongful imprisonment', v.data.buckets[0].key);
        assert.equal(1, v.data.buckets[0].doc_count);
        done();
      })
    });

    it('should make single facet query on movies with field param', function(done) {

      elasticitems.aggregation({
        field: 'genres',
        order: 'asc',
        sort: '_term'
      })
      .then(v => {
        assert.equal(6, v.data.buckets[0].doc_count);
        assert.equal('Action', v.data.buckets[0].key);
        done();
      })
    });

    it('should throw an error for not existing facet', function(done) {

      elasticitems.aggregation()
      .catch(v => {
        done();
      })
    });

    xit('should throw an error for not existing facet', function(done) {

      elasticitems.aggregation({
        name: 'blabla'
      })
      .catch(v => {
        done();
      })
      .error(v => {
        done();
      })
    });
  })

  describe('should make similarity on movies', function() {

    it('makes a simple similarity', function(done) {

      elasticitems.search({
        query: 'the godfather 1972'
      })
      .then(result => {
        assert.deepEqual('The Godfather', result.data.items[0].name);
        return elasticitems.similar(result.data.items[0].id, {
          fields: ['actors']
        })
      })
      .then(result => {
        assert.deepEqual('The Godfather: Part II', result.data.items[0].name);
        done();
      })
    });
  })
})
