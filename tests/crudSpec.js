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

describe('should make crud operations', function() {

  before(function(done) {

    elasticitems = search({
      host: HOST,
      index: INDEX,
      // should be optional
      type: INDEX
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
      return elasticbulk.import([], {
        index: INDEX,
        host: HOST
      }, search_config.schema)
    })
    .delay(1000)
    .then(v => {
      done();
    })
  })

  it('adds new item', function(done) {

    elasticitems.add({
      id: 'shawshank',
      permalink: 'shawshank',
      name: 'The Shawshank Redemption',
      tags: ['drama', 'escape', 'prison']
    }, {
      refresh: true
    })
    .then(v => {
      assert.equal(true, v.created)
      done();
    })
  });

  it('should get item', function(done) {

    elasticitems.get('shawshank')
    .then(v => {
      assert.equal('shawshank', v.id)
      assert.equal('The Shawshank Redemption', v.name)
      done();
    })
  });

  it('should get item by key', function(done) {

    elasticitems.getBy('permalink', 'shawshank')
    .then(v => {
      assert.equal('shawshank', v.id)
      assert.equal('The Shawshank Redemption', v.name)
      done();
    })
  });

  it('should not get not existing item', function(done) {

    elasticitems.get('matrix')
    .catch(e => {
      assert.equal('Not Found', e.message)
      assert.equal(404, e.statusCode)
      done();
    })
  });

  it('should make partial update item', function(done) {

    elasticitems.partialUpdate('shawshank', {
      year: 1994
    })
    .then(v => {
      assert.equal(2, v._version)
      done();
    })
  });

  it('should get item', function(done) {

    elasticitems.get('shawshank')
    .then(v => {
      assert.equal('shawshank', v.id)
      assert.equal(1994, v.year)
      assert.equal('The Shawshank Redemption', v.name)
      done();
    })
  });

  it('should delete item', function(done) {

    elasticitems.delete('shawshank')
    .then(v => {
      assert.equal(true, v.found)
      done();
    })
  });

  it('should not get not existing item', function(done) {

    elasticitems.get('shawshank')
    .catch(e => {
      assert.equal('Not Found', e.message)
      assert.equal(404, e.statusCode)
      done();
    })
  });

})
