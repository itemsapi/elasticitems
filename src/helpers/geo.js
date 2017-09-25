'use strict';
var _ = require('lodash');

exports.getGeoPoint = function(latLng) {
  if (!latLng) {
    return;
  }
  return _.map(latLng.split(','), function(val) {
    return parseFloat(val);
  });
};
