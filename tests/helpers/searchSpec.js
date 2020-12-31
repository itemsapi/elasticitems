'use strict';

const assert = require('assert');
const _ = require('lodash');
const searchHelper = require('./../../src/helpers/search');

describe('search helper', function() {

  xit('should merge internal aggregations', function test(done) {

    const aggregations = {
      tags_internal_count: {
        doc_count: 5,
        value: 4,
        title: 'tags_internal_count',
        name: 'tags_internal_count',
        type: 'cardinality'
      },
      tags: {
        doc_count: 5,
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [ [Object], [Object], [Object], [Object] ],
        title: 'Tags',
        name: 'tags',
        size: 10,
        type: 'terms'
      }
    };

    const result = searchHelper.mergeInternalAggregations(aggregations);
    assert.equal(1, _.keys(result).length);
    assert.equal(4, aggregations.tags.total);
    done();
  });


  it('should merge collection aggregations (object) with elastic aggregations', function test(done) {

    const collection_aggregations = {
      tags: {
        type: 'tags',
        field: 'actors',
        size: 10,
        title: 'Tags'
      },
      actors_terms: {
        type: 'terms',
        field: 'actors',
        size: 10,
        position: 100,
        title: 'Actors'
      }
    };

    const elastic_aggregations = {
      tags: {
        doc_count: 0
      },
      actors_terms: {
        doc_count: 0,
        actors_terms: {
          doc_count_error_upper_bound: 0,
          sum_other_doc_count: 0,
          buckets: []
        }
      }
    };

    const result = searchHelper.getAggregationsResponse(
      collection_aggregations,
      elastic_aggregations
    );

    result.should.be.an.instanceOf(Object);
    result.should.have.property('tags');
    result.should.have.property('actors_terms');
    result.tags.should.have.property('position', 0);
    result.actors_terms.should.have.property('name', 'actors_terms');
    result.actors_terms.should.have.property('type', 'terms');
    result.actors_terms.should.have.property('buckets');
    result.actors_terms.should.have.property('title');
    result.actors_terms.should.have.property('position', 100);
    result.actors_terms.should.have.property('doc_count');
    done();
  });
});
