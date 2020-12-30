const assert = require('assert');
const ElasticItems = require('./../src/index');
const movies_config = require('./fixtures/movies_config.json');
const movies_schema = require('./fixtures/movies_schema.json');
const movies = require('./fixtures/movies.json');
const HOST = process.env.HOST || 'http://localhost:9205';
const INDEX = 'test';
const elasticsearch = require('@elastic/elasticsearch');
const Promise = require('bluebird');
//const elasticbulk = require('elasticbulk');
const elasticbulk = require('/home/mateusz/node/elasticbulk');

const elasticitems = ElasticItems({
  host: HOST,
  index: INDEX,
  type: INDEX,
}, movies_config);

const { Client } = require('@elastic/elasticsearch')
const elastic = new Client({
  node: HOST
})


describe('should make crud operations', function() {

  before(async function() {

    await elastic.indices.delete({
      index: INDEX,
      ignore_unavailable: true,
    })
      .catch(v => {
        console.log('delete');
        console.log(v);
      });

    const schema = {
      settings: {
        index: {
          number_of_shards: 1,
          number_of_replicas: 1
        }
      },
      mappings: {
        properties: movies_schema
      }
    };

    await elasticbulk.import(movies, {
      index: INDEX,
      host: HOST,
      debug: true,
      engine: 'elasticsearch7x',
    }, schema)
      .delay(1000)
      .catch(v => {
        console.log('import');
        console.log(v);
      });
  });


  it('adds new item', async function() {

    const v = await elasticitems.add({
      id: 'shawshank',
      permalink: 'shawshank',
      name: 'The Shawshank Redemption',
      tags: ['drama', 'escape', 'prison']
    }, {
      refresh: true
    });

    assert.equal('created', v.result);
  });

  it('should get item', async function() {

    const v = await elasticitems.get('shawshank');
    assert.equal('shawshank', v.id);
    assert.equal('The Shawshank Redemption', v.name);
  });

  it('should get item by key', async function() {

    const v = await elasticitems.getBy('permalink', 'shawshank');
    assert.equal('shawshank', v.id);
    assert.equal('The Shawshank Redemption', v.name);
  });

  it('should not get not existing item', async function() {

    try {
      await elasticitems.get('matrix');
    } catch (e) {
      assert.equal('Response Error', e.message);
      assert.equal(404, e.statusCode);
    }
  });

  it('should make partial update item', async function() {

    const v = await elasticitems.partialUpdate('shawshank', {
      year: 1994
    });

    assert.equal('updated', v.result);
    assert.equal(2, v._version);
  });

  it('should get item', async function() {

    const v = await elasticitems.get('shawshank');
    assert.equal('shawshank', v.id);
    assert.equal(1994, v.year);
    assert.equal('The Shawshank Redemption', v.name);
  });

  it('should delete item', async function() {

    const v = await elasticitems.delete('shawshank');
    assert.equal('deleted', v.result);
  });

  it('should not get not existing item', async function() {

    try {
      await elasticitems.get('shawshank');
    } catch (e) {
      assert.equal('Response Error', e.message);
      assert.equal(404, e.statusCode);
    }
  });

});
