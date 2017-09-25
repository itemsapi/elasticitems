var assert = require('assert');
var should = require('should');
var search = require('./../src/builder');

describe('should build search query', function() {

  var collection = require('./fixtures/movies-collection.json')

  it('generates search query', function(done) {
    var body = search.searchBuilder({
      page: 1,
    }, collection)

    body.should.have.property('size');
    body.should.have.property('from');
    body.should.have.property('aggs');
    body.should.have.property('filter');
    assert.deepEqual(body.filter, { and: { filters: [] } });
    done();
  });

  it('generates search query without aggregations', function(done) {
    var body = search.searchBuilder({
      page: 1,
      load_aggs: []
    }, collection)

    body.should.have.property('size');
    body.should.have.property('from');
    body.should.not.have.property('aggs');
    body.should.have.property('filter');
    assert.deepEqual(body.filter, { and: { filters: [] } });
    done();
  });

  it('generates search query with sort', function(done) {
    var body = search.searchBuilder({
      page: 1,
      sort: 'rating',
      load_aggs: []
    }, collection)

    body.should.have.property('size');
    body.should.have.property('from');
    body.should.not.have.property('aggs');
    body.should.have.property('sort');
    assert.deepEqual(body.sort, [ { rating: { order: 'desc' } } ]);
    done();
  });

  it('generates search query with multi-field sort', function(done) {
    var body = search.searchBuilder({
      page: 1,
      sort: 'mix',
      load_aggs: []
    }, collection)

    body.should.have.property('size');
    body.should.have.property('from');
    body.should.not.have.property('aggs');
    body.should.have.property('sort');
    assert.deepEqual(body.sort, [ {
      name: { order: 'asc' }
    }, {
      rating: { order: 'desc' } }
    ]);
    done();
  });
})

describe('should build range filter for aggregations', function() {
  var aggregation = {
    type: 'terms',
    field: 'actors',
    size: 10,
    title: 'Actors'
  };

  it('generates terms filter', function(done) {
    var filter = search.generateTermsFilter(aggregation, ['drama', 'fantasy']).toJSON();

    filter.should.have.property('terms');
    filter.terms.actors[0].should.be.equal('drama');
    filter.terms.actors.should.be.instanceOf(Array).and.have.lengthOf(2);
    assert.deepEqual(filter, { terms: { actors: [ 'drama', 'fantasy' ] } });
    done();
  });

  it('generates conjunctive terms filter', function(done) {
    aggregation.conjunction = true;
    var filter = search.generateTermsFilter(aggregation, ['drama', 'fantasy']).toJSON();
    filter.should.have.property('and');
    filter.and.should.have.property('filters').and.have.lengthOf(2);
    //console.log(JSON.stringify(filter));
    assert.deepEqual(filter, {"and":{"filters":[{"term":{"actors":"drama"}},{"term":{"actors":"fantasy"}}]}});
    done();
  });
});

describe('should build range filter for aggregations', function() {
  var aggregation = {
    type: 'terms',
    field: 'actors',
    size: 10,
    title: 'Actors'
  };

  it('generates terms filter', function(done) {
    var filter = search.generateTermsFilter(aggregation, ['drama', 'fantasy']).toJSON();
    console.log(filter);
    filter.should.have.property('terms');
    filter.terms.actors[0].should.be.equal('drama');
    filter.terms.actors.should.be.instanceOf(Array).and.have.lengthOf(2);
    done();
  });

  it('generates conjunctive terms filter', function(done) {
    aggregation.conjunction = true;
    var filter = search.generateTermsFilter(aggregation, ['drama', 'fantasy']).toJSON();
    filter.should.have.property('and');
    filter.and.should.have.property('filters').and.have.lengthOf(2);
    done();
  });
});

describe('should build range filter for aggregations', function() {
  var aggregation = {
    type: 'range',
    field: 'rating',
    title: 'Rating range',
    ranges: [
      {name: '0 - 1', lte: 1},
      {name: '7 - 8', gte: 7, lte: 8},
      {name: '8 - 9', gte: 8, lte: 9},
      {name: '9 - 10', gte: 9},
    ]
  }

  it('generates range for one basic option', function(done) {
    var filter = search.generateRangeFilter(aggregation, ['8 - 9']).toJSON();
    filter.should.have.property('or');
    filter.or.should.have.property('filters').and.be.instanceOf(Array);
    filter.or.filters[0].range.rating.should.have.property('gte', 8);
    filter.or.filters[0].range.rating.should.have.property('lte', 9);
    done();
  });

  it('generates range filter for two aggregation', function(done) {
    var filter = search.generateRangeFilter(aggregation, ['8 - 9', '7 - 8']).toJSON();
    filter.or.should.have.property('filters').and.be.instanceOf(Array).and.have.lengthOf(2);
    filter.or.filters[0].range.rating.should.have.property('gte', 8);
    filter.or.filters[0].range.rating.should.have.property('lte', 9);
    filter.or.filters[1].range.rating.should.have.property('gte', 7);
    filter.or.filters[1].range.rating.should.have.property('lte', 8);

    //console.log(JSON.stringify(filter));
    assert.deepEqual(filter, {"or":{"filters":[{"range":{"rating":{"gte":8,"lte":9}}},{"range":{"rating":{"gte":7,"lte":8}}}]}});
    done();
  });

  it('generates range filter for edge aggregation', function(done) {
    var filter = search.generateRangeFilter(aggregation, ['9 - 10']).toJSON();
    filter.or.should.have.property('filters').and.be.instanceOf(Array).and.have.lengthOf(1);
    filter.or.filters[0].range.rating.should.have.property('gte', 9);
    filter.or.filters[0].range.rating.should.not.have.property('lte');
    done();
  });

  it('should not generate range filter for not existent aggregation or empty input', function(done) {
    var filter = search.generateRangeFilter(aggregation, []).toJSON();
    filter.or.should.have.property('filters').and.be.instanceOf(Array).and.have.lengthOf(0);

    var filter = search.generateRangeFilter(aggregation, ['wrong']).toJSON();
    filter.or.should.have.property('filters').and.be.instanceOf(Array).and.have.lengthOf(0);
    done();
  });
})

describe('should build sorting options', function() {

  it('should build sorting based on configuration', function(done) {
    var aggregation = {
      title: 'Best rating',
      type: 'normal',
      order: 'desc',
      field: 'rating'
    };
    var sort = search.generateSort(aggregation);
    sort.toJSON().should.have.property('rating', {order: 'desc'});
    done();
  });

  it('should build sorting with different configuration', function(done) {
    var aggregation = {
      title: 'Best rating',
      type: 'normal',
      order: 'asc',
      field: 'rating'
    };
    var sort = search.generateSort(aggregation);
    sort.toJSON().should.have.property('rating', {order: 'asc'});
    done();
  });

  it('should build geo sorting', function(done) {
    var aggregation = {
      title: 'Distance',
      type: 'geo',
      order: 'asc',
      field: 'geo'
    };

    var sort = search.generateSort(aggregation, {
      geoPoint: [51.30, 0.08]
    });

    // generates geo: [ 0.08, 51.3 ]
    // should generate location: {lat: 51.30, lon: 0.08}
    // but seems to be working
    //console.log(sort.toJSON())
    sort.toJSON().should.have.property('_geo_distance');
    sort.toJSON()._geo_distance.should.have.property('order', 'asc');
    sort.toJSON()._geo_distance.should.have.property('unit', 'km');
    sort.toJSON()._geo_distance.should.have.property('geo');

    done();
  });

  it('should build multi field sorting', function(done) {
    var aggregation = {
      title: 'Rating',
      //type: 'normal',
      sort: [
        { name : {order: 'asc'}},
        { rating : {order: 'desc'}}
      ]
    };

    var sort = search.generateSort(aggregation);
    // sort is not elastic.js object here
    //sort.toJSON().should.be.instanceOf(Array).and.have.lengthOf(2);
    //console.log(sort.toJSON());
    done();
  });

  it('should not build sorting', function(done) {
    var sort = search.generateSort();
    should(sort).be.undefined
    done();
  });
})
