var assert = require('assert');
var should = require('should');
var search = require('./../src/index');
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

  before(function(done) {

    elasticitems = search({
      host: HOST,
      index: INDEX,
    }, search_config);

    elastic = new elasticsearch.Client({
      host: HOST,
      defer: function () {
        return Promise.defer();
      }
    });

    elastic.indices.delete({
      index: INDEX
    })
    .catch(v => {
    })
    .then(v => {
      return elasticbulk.import(movies, {
        index: INDEX,
        host: HOST
      }, search_config.schema)
    })
    .delay(1000)
    .then(v => {
      done();
    })
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

        //console.log(v.data.aggregations.tags);
        //assert.equal(undefined, v.data.aggregations.tags.doc_count)
        assert.equal(92, v.data.aggregations.tags.buckets.length)
        assert.equal('Tags', v.data.aggregations.tags.title)
        assert.equal(466, v.data.aggregations.actors.buckets.length)
        assert.equal(466, v.data.aggregations.actors_or.buckets.length)
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

  describe('should make aggretations on movies', function() {

  })

  describe('should make similarity on movies', function() {

  })
})
