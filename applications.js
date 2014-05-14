'use strict';

/**
 * @fileOverview Defines the Applications prototype and its methods.
 */
module.exports = Applications;

var express = require('express');
var Model = require('model.js');
var HTTPStatus = require('http-status');

/**
 * Applications constructor.
 *
 * @class
 *
 * Applications allows for querying, updating, and deleting of application info. An application defines the credentials
 * to use to talk to a notification service such as APNs or WNS.
 *
 * @param {ApplicationsStore} applicationsStore the {@link ApplicationsStore} instance to rely on for persistent data
 * operations.
 */
function Applications(applicationsStore) {
    this.log = require('./config').log('Applications');
    this.log.BEGIN(applicationsStore);
    this.applicationsStore = applicationsStore;

    /**
     * JSON schema for appId values. Contains just one value:
     *
     * - appId: the application to operate on
     *
     * @type Model
     */
    this.AppIdModel = Model.extend(
        {
            appId: {required:true, type:'string', minlength:2, maxlength:128}
        });

    /**
     * JSON schema for APNs credentials.
     *
     * - certificate: the public certificate to use when connecting to APNs
     * - privateKey: the private key to use when connecting to APNs
     * - passphrase: the passphrase of the privateKey
     * - useSandbox: true if connecting to the sandbox APNs service. Otherwise, connect to the production one.
     *
     * @type Model
     */
    this.APNsModel = Model.extend(
        {
            certificate: {required:true, type:'string', minlength:1},
            privateKey: {required:true, type:'string', minlength:1},
            passphrase: {required:true, type:'string', minlength:1},
            useSandbox: {required:false, type:'boolean'}
        });

    /**
     * JSON schema for GCM credential.
     *
     * - authorizationKey: the key obtained from GCM to use when submitting push requests
     *
     * @type Model
     */
    this.GCMModel = Model.extend(
        {
            authorizationKey: {required:true, type:'string', minlength:1}
        });

    /**
     * JSON schema for WNS credentials.
     *
     * - packageSID: the package SID obtained from Windows Store to use when authenticating with WNS.
     * - clientSecret: the client secret obtained from Windows Store to use when authenticating with WNS.
     *
     * @type Model
     */
    this.WNSModel = Model.extend(
        {
            packageSID: {required:true, type:'string', minlength:1},
            clientSecret: {required:true, type:'string', minlength:1}
        });

    this.log.END();
}

Applications.prototype = {

    /**
     * Add Express routes for the Applications API.
     *
     * @param {Express.App} app The application to route HTTP requests.
     */
    route: function(app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.get('/applications/:appId', this.get.bind(this));
        app.post('/applications/:appId', this.set.bind(this));
        app.del('/applications/:appId', this.del.bind(this));
        log.END();
    },

    /**
     * Obtain the current settings for a given appId.
     *
     * @example HTTP GET /foobar
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body is ignored; the URL must contain
     * the user ID to use, and it must adhere to the {@link Registrar#UserIdModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 200 OK if one or more registrations were found
     * - 400 BAD REQUEST if missing or invalid query attribute(s)
     * - 404 NOT FOUND if no templates were found for the given key attributes
     */
    get: function (req, res) {
        var log = this.log.child('get');
        var params = {appId: req.param('appId')};
        log.BEGIN(params);

        var errors = this.AppIdModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:',JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        this.applicationsStore.get(params.appId, function (err, value) {
            var duration = Date.now() - start;
            if (err !== null || typeof(value) === 'undefined') {
                if (err) log.error('error:', err);
                log.info('no appId found');
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                var tmp = {
                    'credentials': value,
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                res.json(HTTPStatus.OK, tmp);
            }
            log.END(duration, 'msec');
        });
    },

    /**
     * Add or update a registration for a given user.
     *
     * @example <code>{deviceId: "1234-56-7890", templateVersion: "3", templateLanguage: "en-US",
     *  service: "apns",
     *  routes:[{name: "main", token: "unique main token", secondsToLive: 86400},
     *          {name: "alt", token: "unique alt token", secondsToLive: 86400}]}
     * </code>
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body must be JSON that follows the
     * {@link Registrar#RegistrationModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 200 OK: successfully processed request
     * - 400 BAD REQUEST: missing or invalid attribute(s)
     */
    set: function (req, res) {
        var self = this;
        var log = self.log.child('set');
        log.BEGIN();

        var params = req.body;
        params.userId = req.param('userId');
        log.info('params:', params);

        var errors = self.RegistrationModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(params));
            self.monitorManager.post(params.userId, 'invalid registration: ' + JSON.stringify(params));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        self.registrationStore.set(params, function (err, registrationEntity) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.set error:', err);
                self.monitorManager.post(params.userId, 'failed to store registration');
                res.send(HTTPStatus.BAD_REQUEST);
            }
            else {
                var tmp = {
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                self.monitorManager.post(params.userId, 'registration: ' + JSON.stringify(params));
                res.json(HTTPStatus.OK, tmp);
            }
            log.END(params.userId, duration, 'msec');
        });
    },

    /**
     * Delete a registration or all registrations for a given user. If a JSON payload exits with a deviceId
     * attribute, only delete the one entity matching the deviceId value. Otherwise, delete all registrations for
     * the user.
     *
     * @example <code>{}</code>
     *
     * @example <code>{deviceId: "1234-56-7890"}</code>
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body must be JSON that follows the
     * {@link Registrar#DeleteKeyModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 204 NO CONTENT: found and deleted the registration(s)
     * - 400 BAD REQUEST: missing or invalid attribute(s)
     * - 404 NOT FOUND: unable to locate any registration to delete
     */
    del: function (req, res) {
        var log = this.log.child('del');
        log.BEGIN('body:', req.body);

        var params = {
            userId: req.param('userId')
        };

        var deviceId = req.param('deviceId');
        if (typeof deviceId !== 'undefined') {
            params.deviceId = deviceId;
        }

        log.info('params:', params);
        var errors = this.DeleteKeyModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        function callback(err) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.del error:', err);
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                self.monitorManager.post(params.userId, 'removed registration(s)');
                res.send(HTTPStatus.NO_CONTENT);
            }
            log.END(params.userId, deviceId, duration, 'msec');
        }

        if (params.deviceId === undefined) {
            this.registrationStore.delAll(params.userId, callback);
        }
        else {
            this.registrationStore.del(params.userId, params.deviceId, callback);
        }
    }
};
