'use strict';

var assert = require('assert');
var HTTPStatus = require('http-status');
var fs = require('fs');
var http = require('http');
var https = require('https');
var pact = require('pact');
var Request = require('request');
var vows = require('vows');
var App = require('../server.js');

var host = '127.0.0.1';
var port = 4465;
var key = fs.readFileSync("certs/client.key");
var cert = fs.readFileSync('certs/client.cert');
var agent = new https.Agent({key:key, cert:cert});
var server = null;

function listen() {
    return function() {
        var vows = this;
        server.listen(port, host, function (err) { vows.callback(err); });
    };
}

function request(req) {
    req.uri = 'https://' + host + ':' + port + req.uri;
    req.headers = {'Content-Type': 'application/json'};
    req.key = key;
    req.cert = cert;
    req.agent = agent;
    return function() {
        Request(req, this.callback);
    };
}

function statusCheck(code) {
    return function(err, resp, body) {
        assert.strictEqual(resp.statusCode, code);
    };
}

function makeQuery(obj) {
    var args = [];
    for(var p in obj)
        args.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    return args.join("&");
}

var validRegistration_WNS = {
    registrationId: 'myregistration_WNS',
    templateVersion: '3.0',
    templateLanguage: 'en-us',
    service: 'wns',
    routes: [ { 'name': '*', 'token': 'http://www.iana.org/domains/example', 'secondsToLive': 60 } ]
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

var validPost = {
    eventId: 200,
    substitutions: {"A":"aye","B":"3"}
};

var invalidPost = {
    eventId: 201,
    substitutions: {}
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
            var opts = {
                key: fs.readFileSync("certs/server.key"),
                cert: fs.readFileSync("certs/server.cert"),
                ca: fs.readFileSync("certs/ca.cert"),
                requestCert: true,
                rejectUnauthorized: true
            };
            server = https.createServer(opts, app);
            assert.isNull(errors);
            console.log(arguments);
        }
    }
});

// Make sure server has no entries
suite.addBatch(
    {
        'server has no entries': {
            topic: listen(),
            'for a registration query': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2'
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            },
            'for a WNS template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_WNS)
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            },
            'for an APNs template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_APNS)
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            }
        }
    }
);

// Make sure we can add entries to server
suite.addBatch(
    {
        'adding entries to server': {
            topic: listen(),
            'new valid WNS registration': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
                        method: 'POST',
                        json: validRegistration_WNS
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            },
            'new valid APNs registration': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
                        method: 'POST',
                        json: validRegistration_APNS
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            },
            'invalid registration with missing registrationId': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
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
                topic: request(
                    {
                        uri:'/templates',
                        method: 'POST',
                        json: validTemplate_WNS
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            },
            'new valid APNs template': {
                topic: request(
                    {
                        uri:'/templates',
                        method: 'POST',
                        json: validTemplate_APNS
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            }
        }
    }
);

// Make sure we added entries to server
suite.addBatch(
    {
        'server has added entries': {
            topic: listen(),
            'for a registration query': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2'
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            },
            'for a WNS template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_WNS)
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            },
            'for an APNs template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_APNS)
                    }
                ),
                'it should succeed with OK': statusCheck(HTTPStatus.OK)
            }
        }
    }
);

// Make sure we can post to a registered user
suite.addBatch(
    {
        'posting notification request to server': {
            topic: listen(),
            'a valid post request': {
                topic: request(
                    {
                        uri:'/post/br.howes2',
                        method: 'POST',
                        json: validPost
                    }
                ),
                'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
                'it should return 2 matches': function (err, res) {
                    assert.isNull(err);
                    assert.isObject(res);
                    assert.equal(res.body.count, 2);
                }
            },
            'an invalid post request': {
                topic: request(
                    {
                        uri:'/post/br.howes2',
                        method: 'POST',
                        json: {}
                    }
                ),
                'it should fail with BAD REQUEST': statusCheck(HTTPStatus.BAD_REQUEST)
            },
            'a missing post request': {
                topic: request(
                    {
                        uri:'/post/br.howes2',
                        method: 'POST',
                        json: invalidPost
                    }
                ),
                'it should succeed with ACCEPTED': statusCheck(HTTPStatus.ACCEPTED),
                'it should return 0 matches': function (err, res) {
                    assert.isNull(err);
                    assert.isObject(res);
                    assert.equal(res.body.count, 0);
                }
            }
        }
    }
);

// Make sure we can delete entries from server
suite.addBatch(
    {
        'deleting entries from server': {
            topic: listen(),
            'deleting previous registration': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2',
                        method: 'DELETE'
                    }
                ),
                'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
            },
            'deleting previous WNS template': {
                topic: request(
                    {
                        uri:'/templates',
                        method: 'DELETE',
                        json: validTemplate_WNS
                    }
                ),
                'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
            },
            'deleting previous APNs template': {
                topic: request(
                    {
                        uri:'/templates',
                        method: 'DELETE',
                        json: validTemplate_APNS
                    }
                ),
                'it should succeed with NO CONTENT': statusCheck(HTTPStatus.NO_CONTENT)
            }
        }
    }
);

// Make sure we really deleted entries from server
suite.addBatch(
    {
        'server again has no entries': {
            topic: listen(),
            'for a registration query': {
                topic: request(
                    {
                        uri:'/registrations/br.howes2'
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            },
            'for a WNS template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_WNS)
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            },
            'for an APNs template query': {
                topic: request(
                    {
                        uri:'/templates?' + makeQuery(validTemplate_APNS)
                    }
                ),
                'it should fail with NOT FOUND': statusCheck(HTTPStatus.NOT_FOUND)
            }
        }
    }
);

// Make sure we really deleted entries from server
suite.addBatch(
    {
        'stay alive': {
            topic: function () {
                setTimeout(this.callback, 2000);
            },
            'it should succeed': function (a, b) {
                console.log(arguments);
            }
        }
    }
);

suite.export(module);
