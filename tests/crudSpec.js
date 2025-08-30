const assert = require('assert');
const ElasticItems = require('./../src/index');
const movies_config = require('./fixtures/movies_config.json');
const movies_schema = require('./fixtures/movies_schema.json');
const movies = require('./fixtures/movies.json');
const HOST = process.env.HOST || 'http://localhost:9200';
const INDEX = 'test';

const elasticitems = ElasticItems({
  host: HOST,
  index: INDEX,
  type: INDEX,
}, movies_config);

const { Client } = require('@opensearch-project/opensearch');
const elastic = new Client({
  node: HOST
});


describe('should make crud operations', function() {

  before(async function() {

    await elastic.indices.delete({
      index: INDEX,
      ignore_unavailable: true,
    });

    // Create index with schema
    await elastic.indices.create({
      index: INDEX,
      body: movies_schema
    });

    // Bulk import using native helpers
    const bulkBody = movies.flatMap(doc => [
      { index: { _index: INDEX, _id: doc.id } },
      doc
    ]);

    await elastic.bulk({
      refresh: true,
      body: bulkBody
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

    let v = await elasticitems.partialUpdate('shawshank', {
      year: 1995
    });

    assert.equal('updated', v.result);
    assert.equal(2, v._version);

    v = await elasticitems.partialUpdate('shawshank', {
      year: 1994
    });

    assert.equal('updated', v.result);
    assert.equal(3, v._version);
  });

  it('should make partial update item with fields out of schema', async function() {

    const v = await elasticitems.partialUpdate('shawshank', {
      a1: 'xyz',
      a2: 1,
      a3: new Date()
    });

    assert.equal('updated', v.result);
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
