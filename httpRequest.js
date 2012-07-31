'use strict';

module.exports = HTTPRequest;

var config = require('./config');
var Q = require('q');
var request = require('request');
var mlog = config.log('HTTPRequest');

function HTTPRequest(req, callback) {
    mlog.BEGIN(JSON.stringify(req));

    if (typeof req.retryTimeout === 'undefined') {
        req.retryTimeout = 1 * 1000;
    }

    if (typeof req.retryStatusCheck === 'undefined') {
        req.retryStatusCheck =
            function (statusCode) {
                return statusCode >= 500;
            };
    }

    if (typeof req.secondsToLive === 'undefined') {
        req.secondsToLive = 30;
    }

    var lifetime = 0;
    if (req.secondsToLive > 0) {
        lifetime = Date.now() + req.secondsToLive * 1000;
    }

    return initiateRequest(req, lifetime, callback);
}

function initiateRequest(req, lifetime, callback) {
    var log = mlog.child('initiateRequest');
    log.BEGIN(JSON.stringify(req), lifetime);

    if (lifetime > 0 && lifetime <= Date.now()) {
        var err = new Error('HTTPRequest: failed to process ' + JSON.stringify(req));
        log.error(err);
        callback(err, null);
        return err;
    }

    // Invoke request() method wrapping it in a Q promise.
    return Q.ncall(request, null, req)
        .then(function (args) {
                  var resp = args[0];
                  var body = args[1];
                  // Success - but is it something we want?
                  if (req.retryStatusCheck(resp.statusCode)) {
                      log.warn('failed response code check:', resp.statusCode);
                      log.debug('retrying in ',req.retryTimeout, 'ms');
                      return Q.delay(req.retryTimeout)
                          .then(function () {
                                    return initiateRequest(req, lifetime, callback);
                                });
                  }
                  log.info('response:', resp.statusCode);
                  log.debug('body:', body);
                  return callback(null, resp, body);
              },
              function (err) {
                  // Wait configured amount of time and redo the request
                  log.error('error:', err);
                  log.debug('retrying in ',req.retryTimeout, 'ms');
                  return Q.delay(req.retryTimeout)
                      .then(function () {
                                return initiateRequest(req, lifetime, callback);
                            });
            });
}
