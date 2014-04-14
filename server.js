'use strict';

/**
 * @fileOverview Main application. Provides three kinds of services: a registrar, a template manager, and a notifier.
 */
module.exports = App;

var config = require('./config');
var express = require('express');
var http = require('http');
var https = require('https');
var APNs = require('./APNs');
var GCM = require('./GCM');
var Notifier = require('./notifier');
var Registrar = require('./registrar');
var RegistrationStore = require('./registrationStore');
var TemplateManager = require('./templateManager');
var TemplateStore = require('./templateStore');
var WNS = require('./WNS');

/**
 * App constructor.
 *
 * @class
 *
 * An App object contains routes for HTTP/S requests to appropriate services.
 */
function App()
{
    this.log = config.log('App');
    this.registrationStoreName = config.registrations_table_name;
    this.templateStoreName = config.templates_table_name;
}

/**
 * App prototype.
 *
 * Defines the methods available to an App instance.
 */
App.prototype = {

    /**
     * Initialize an App instance with the necessary services.
     *
     * @param {Function} callback the function to invoke when the App is initialized.
     */
    initialize: function(callback) {
        var log = this.log.child('initialize');
        var self = this;
        var awaiting = 2;
        var errors = null;
        var app = express();
        var registrationStore;
        var templateStore;

        var continuation = function(key, err) {
            var clog = log.child('continuation');
            clog.BEGIN(awaiting, key, err);

            --awaiting;
            if (err !== null) {
                clog.error(key, 'error:', err);
                if (errors === null) {
                    errors = {};
                }
                errors[key] = err;
            }

            if (awaiting === 0) {
                clog.info('creating notifier');
                var senders = {};
                try {
                    senders.wns = new WNS();
                }
                catch (x) {
                    clog.error(x);
                }

                try {
                    senders.apns = new APNs();
                }
                catch (x) {
                    clog.error(x);
                }

                try {
                    senders.gcm = new GCM();
                }
                catch (x) {
                    clog.error(x);
                }

                var service = new Notifier(templateStore, registrationStore, senders);
                service.route(app);
                callback(app, errors);
                clog.END();
                return;
            }

            clog.END('awaiting:', awaiting);
        };

        log.BEGIN();

        app.use(app.router);

        app.configure('development', function () {
            app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
        });

        app.configure('production', function () {
            app.use(express.errorHandler());
        });

        app.post('*', express.json());
        app.del('*', express.json());

        registrationStore = new RegistrationStore(this.registrationStoreName, function(err) {
            log.info('creating registrar');
            var service = new Registrar(registrationStore);
            service.route(app);
            continuation('registrationStore', err);
        });

        templateStore = new TemplateStore(this.templateStoreName, function(err) {
            log.info('creating template manager');
            var service = new TemplateManager(templateStore);
            service.route(app);
            continuation('templateStore', err);
        });

        log.END();
    }
};

// Run if we are the main script
if (process.argv[1].indexOf('server.js') !== -1) {
    var log = config.log('main');
    var app = new App();
    var port = process.env.PORT || 4465;

    process.on('uncaughtException', function (err) { console.log(err); });

    app.initialize(
        function (app, errors) {
            if (errors !== null) {
                log.error('failed to start due to errors during initialization: ', errors);
            }
            else {
                var server;
                if (config.ssl_authentication_enabled) {
                    var options = {
                        key: config.ssl_server_key,
                        passphrase: config.ssl_server_key_passphrase,
                        cert: config.ssl_server_certificate,
                        ca: config.ssl_ca_certificate,
                        requestCert: true,
                        rejectUnauthorized: config.ssl_reject_unauthorized
                        };
                    server = https.createServer(options, app);
                }
                else {
                    server = http.createServer(app);
                }
                log.info('starting server on port', port);

                server.listen(port);
            }
        }
    );
}
