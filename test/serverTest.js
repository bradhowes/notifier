'use strict';

var assert = require('assert');
var HTTPStatus = require('http-status');
var config = require('../config');
var fs = require('fs');
var http = require('http');
var https = require('https');
var log4js = require('log4js');
var pact = require('pact');
var request = require('request');
var vows = require('vows');
var App = require('../server');

var host = 'localhost';
var port = 4465;

var agent;
if (config.ssl_authentication_enabled) {
    var key = fs.readFileSync("certs/client.key");
    var cert = fs.readFileSync('certs/client.cert');
    var ca = [fs.readFileSync('certs/ca.cert')];
    agent = new https.Agent({key:key, cert:cert, ca:ca});
}

var server = null;

var validRegistration_WNS = {
    registrationId: 'myregistration_WNS',
    templateVersion: '3.0',
    templateLanguage: 'en-us',
    service: 'wns',
    routes: [ { 'name': '*',
                'token': 'https://db3.notify.windows.com/?token=AgYAAAAeMSsYVg4AoTlZmb3zsib4Mv%2bUw30tgjgBkmIYh%2fc97tzD8LV1qnzjbEBtrcnnH0BkZxyFw2H%2bQzubrWElpu6tFC6GUaKm3fzvB0NWBoSudh08tTBW1O15%2fza80a4Bows%3d',
                'secondsToLive': 60 } ]
};

var validRegistration_APNS = {
    registrationId: 'myregistration_APNS',
    templateVersion: '3.0',
    templateLanguage: 'en-us',
    service: 'apns',
    routes: [ { 'name': '*', 'token': '6aBSE3NLfNw9TwAEUgV+pHgeVU6eEWraSar9f4ycf98=', 'secondsToLive': 60 } ]
};

var validTemplate_WNS = {
    eventId: 200,
    notificationId: 100,
    templateVersion: '3.0',
    templateLanguage: 'en',
    route: '*',
    service: 'wns',
    template: {
        kind: 'wns/badge',
        content: '<?xml version="1.0" encoding="utf-8"?><badge value="@@B@@"/>'
    }
};

var validTemplate_APNS = {
    eventId: 200,
    notificationId: 100,
    templateVersion: '3.0',
    templateLanguage: 'en',
    route: '*',
    service: 'apns',
    template: {
        content: '{"aps":{"alert":"Hello, @@A@@ World!","badge":@@B@@,"sound":"default"}}'
    }
};

var validPost = function (post) {
    if (typeof post === 'undefined') post = {};
    if (typeof post.eventId === "undefined") post.eventId = 200;
    if (typeof post.substitutions === "undefined") post.substitutions = {"A":"aye","B":"3"};
    return post;
};

var invalidPost = function (post) {
    if (typeof post === 'undefined') post = {};
    return post;
};

var suite = vows.describe('REST API testing');

suite.addBatch(
{
    'start server': {
        topic: function () {
            var app = new App();
            app.registrationStoreName = 'serverTestRegistrations';
            app.templateStoreName = 'serverTestTemplates';
            app.initialize(this.callback);
        },
        'successfully': function (app, errors) {
            assert.isNull(errors);
            if (config.ssl_authentication_enabled) {
                var opts = {
                    key: config.ssl_server_key,
                    passphrase: config.ssl_server_key_passphrase,
                    cert: config.ssl_server_certificate,
                    ca: config.ssl_ca_certificate,
                    requestCert: true,
                    rejectUnauthorized: config.ssl_reject_unauthorized
                };
                server = https.createServer(opts, app);
            }
            else {
                server = http.createServer(app);
            };

            server.listen(port, host);
        }
    }
});

function makeRequest(options, cb) {
    options.uri = (agent ? 'https://' : 'http://') + host + ':' + port + options.path;
    options.headers = {'Content-Type': 'application/json'};
    options.agent = agent;
    return function() {
        request(options, this.callback);
    };
}

function statusCheck(code) {
    return function(err, res, body) {
        assert.strictEqual(res.statusCode, code);
    };
}

function makeQuery(obj) {
    var args = [];
    for(var p in obj)
        args.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    return args.join("&");
}

// Make sure server has no entries
suite.addBatch(
    {
        'for a registration query': {
            topic: makeRequest(
                {
                    path: '/registrations/br.howes2'
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        },
        'for a WNS template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_WNS)
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        },
        'for an APNs template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_APNS)
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        }
    }
);

// Make sure we can add entries to server
suite.addBatch(
    {
        'new valid WNS registration': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: validRegistration_WNS
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        },
        'new valid APNs registration': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: validRegistration_APNS
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        },
        'invalid registration with missing registrationId': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        templateVersion: '3.0',
                        templateLanguage: 'en-us',
                        service: 'wns',
                        routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with missing templateVersion': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateLanguage: 'en-us',
                        service: 'wns',
                        routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with missing templateLanguage': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateVersion: '1.0',
                        service: 'wns',
                        routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with missing service': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateVersion: '1.0',
                        templateLanguage: 'en-us',
                        routes: [ { 'name': '*', 'token': '123', 'secondsToLive': 60 } ]
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with missing route': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateVersion: '1.0',
                        templateLanguage: 'en-us',
                        service: 'wns'
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with empty route': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateVersion: '1.0',
                        templateLanguage: 'en-us',
                        service: 'wns',
                        route: []
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'invalid registration with invalid route': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'POST',
                    json: {
                        registrationId: '123',
                        templateVersion: '1.0',
                        templateLanguage: 'en-us',
                        service: 'wns',
                        route: [{name: '', token: '', secondsToLive: 12345}]
                    }
                }),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        },
        'new valid WNS template': {
            topic: makeRequest(
                {
                    path:'/templates',
                    method: 'POST',
                    json: validTemplate_WNS
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        },
        'new valid APNs template': {
            topic: makeRequest(
                {
                    path:'/templates',
                    method: 'POST',
                    json: validTemplate_APNS
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        }
    }
);

// Make sure we added entries to server
suite.addBatch(
    {
        'for a registration query': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2'
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        },
        'for a WNS template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_WNS)
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        },
        'for an APNs template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_APNS)
                }
            ),
            'it should succeed with OK': statusCheck(HTTPStatus.OK)
        }
    }
);

// Make sure we can post to a registered user
suite.addBatch(
    {
        'a valid post request': {
            topic: makeRequest(
                {
                    path:'/post/br.howes2',
                    method: 'POST',
                    json: validPost()
                }
            ),
            'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
            'it should return 2 matches': function(err, res, body) {
                assert.isNull(err);
                assert.isObject(res);
                assert.equal(res.body.count, 2);
            }
        },
        'a valid filtered post request': {
            topic: makeRequest(
                {
                    path:'/post/br.howes2',
                    method: 'POST',
                    json: validPost({"filter":{"service":["wns"]}})
                }
            ),
            'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
            'it should return 1 match': function (err, res, body) {
                assert.isNull(err);
                assert.isObject(res);
                assert.equal(res.body.count, 1);
            }
        },
        'a valid post request with empty substitutions': {
            topic: makeRequest(
                {
                    path:'/post/br.howes2',
                    method: 'POST',
                    json: validPost({"substitutions":{}})
                }
            ),
            'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
            'it should return 2 match': function (err, res, body) {
                assert.isNull(err);
                assert.isObject(res);
                assert.equal(res.body.count, 2);
            }
        },
        'a valid post request with an empty filter': {
            topic: makeRequest(
                {
                    path:'/post/br.howes2',
                    method: 'POST',
                    json: validPost({"filter":{}})
                }
            ),
            'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
            'it should return 2 match': function (err, res, body) {
                assert.isNull(err);
                assert.isObject(res);
                assert.equal(res.body.count, 2);
            }
        },
        'an invalid post request with missing eventId': {
            topic: makeRequest(
                {
                    path:'/post/br.howes2',
                    method: 'POST',
                    json: invalidPost()
                }
            ),
            'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
        }
    }
);

// Make sure we can delete entries from server
suite.addBatch(
    {
        'deleting previous WNS registration': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'DELETE',
                    json: {registrationId: "myregistration_WNS"}
                }
            ),
            'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
        },
        'deleting previous APNS registration': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2',
                    method: 'DELETE',
                    json: {registrationId: "myregistration_APNS"}
                }
            ),
            'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
        },
        'deleting previous WNS template': {
            topic: makeRequest(
                {
                    path:'/templates',
                    method: 'DELETE',
                    json: validTemplate_WNS
                }
            ),
            'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
        },
        'deleting previous APNs template': {
            topic: makeRequest(
                {
                    path:'/templates',
                    method: 'DELETE',
                    json: validTemplate_APNS
                }
            ),
            'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
        }
    }
);

// Make sure we really deleted entries from server
suite.addBatch(
    {
        'for a registration query': {
            topic: makeRequest(
                {
                    path:'/registrations/br.howes2'
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        },
        'for a WNS template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_WNS)
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        },
        'for an APNs template query': {
            topic: makeRequest(
                {
                    path:'/templates?' + makeQuery(validTemplate_APNS)
                }
            ),
            'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
        }
    }
);

suite.export(module, {error: false});
