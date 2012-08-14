'use strict';

/**
 * @fileOverview Defines the Notifier prototype and its methods.
 */
module.exports = Notifier;

var express = require('express');
var HTTPStatus = require('http-status');
var Model = require('model.js');
var PostTracker = require('./postTracker');

/**
 * Notifier constructor
 *
 * @class
 *
 * A Notifier pairs notification templates to user registrations and emits those that match.
 *
 * @param {TemplateStore} templateStore the repository of notification templates to rely on
 * @param {RegistrationStore} registrationStore the repository of user registrations to rely on
 * @param {PayloadGenerator} generator the notification generator to use for template processing
 * @param {Hash} senders a mapping of notification service tags to objects that provide a sendNotification method
 */
function Notifier(templateStore, registrationStore, generator, senders) {
    this.log = require('./config').log('Notifier');
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;

    this.sequenceId = 1;
    this.postTracker = new PostTracker(100);

    this.FilterModel = Model.extend(
        {
            registrationId: {type: 'array'},
            templateVersion: {type: 'array'},
            templateLanguage: {type: 'array'},
            service: {type: 'array'},
            routeName: {type: 'array'},
            routeToken: {type: 'array'}
        }
    );

    /**
     * JSON schema for a notification posting.
     * @type Model
     */
    this.PostModel = Model.extend(
        {
            userId: {required:true, type:'string', minlength:2, maxlength:128},
            eventId: {required:true, type:'integer'},
            substitutions: {type:'stringmap'},
            filter: {type: 'filter'}
        },
        {
            types:
            {
                stringmap: function (value) {
                    if (typeof value !== 'object') return null;
                    for (var key in value) {
                        if (typeof value[key] !== 'string') return null;
                    }
                    return value;
                },
                filter: function (value) {
                    var log = this.log.child('filter model');
                    var err = this.FilterModel.validate(value);
                    log.debug('filter validation:', err);
                    if (err !== null) return null;
                    return value;
                }.bind(this)
            }
        }
    );

    this.LogReceiptModel = Model.extend(
        {
            sequenceId: {required:true, type:'integer'},
            when: {required:true, type:'date'}
        }
    );
}

/**
 * Notifier prototype.
 *
 * Defines the methods available to an Notifier instance.
 */
Notifier.prototype = {

    /**
     * Add Express routes for the Notifier API.
     *
     * @param {Express.App} app the application to route
     */
    route: function (app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.post('/post/:userId', express.json(), this.postNotification.bind(this));
        app.post('/logReceipt', express.json(), this.logReceipt.bind(this));
        log.END();
    },

    /**
     * Post a notification to a user.
     *
     * @param {Request} req incoming HTTP request settings and values
     *
     * @param {Response} res outgoing HTTP response values
     */
    postNotification: function (req, res) {
        var self = this, duration;
        var log = self.log.child('postNotification');
        var result = {count: 0};
        log.BEGIN();

        var params = {
            userId: req.param('userId'),
            eventId: req.param('eventId'),
            substitutions: req.param('substitutions'),
            filter: req.param('filter')
        };

        log.info('params:', params);

        var errors = this.PostModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            log.error(params);
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var substitutions = params.substitutions;
        if (typeof substitutions !== 'object') {
            substitutions = {};
            params.substitutions = substitutions;
        }

        var start = Date.now();
        log.debug('start:', start);

        var sequenceId = ++this.sequenceId;
        substitutions.SEQUENCE_ID = sequenceId;
        this.postTracker.add(sequenceId, start);

        // Fetch the registrations for the given user
        this.registrationStore.get(params.userId, params.filter, function (err, registrations) {
            if (err !== null) {
                log.error('RegistrationStore.get error:', err);
                res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
                return;
            }

            if (registrations.length === 0) {
                log.info('no registrations exist for user', params.userId);
                res.send(HTTPStatus.NO_CONTENT);
                duration = Date.now() - start;
                log.END(duration, 'msecs');
                return;
            }

            // Find the templates that apply for the given registrations
            self.templateStore.find(params.eventId, registrations, function (err, matches) {
                var token = null;
                if (err !== null) {
                    log.error('TemplateStore.find error:', err);
                    res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
                    duration = Date.now() - start;
                    log.END(duration, 'msecs');
                    return;
                }

                if (matches.length === 0) {
                    log.info('TemplateStore.find returned no matches');
                }

                result.count = matches.length;
                res.json(HTTPStatus.ACCEPTED, result);

                // For each template, generate a notification payload and send it on its way.
                for (var index in matches) {
                    var request = matches[index];
                    request.prepare(substitutions, params.userId, self.registrationStore, 30);
                    self.deliver(request);
                }

                duration = Date.now() - start;
                log.END(duration, 'msecs');
            });
        });
    },

    /**
     * Log the receipt of a notification from an external device.
     *
     * @param {Request} req incoming HTTP request settings and values. Input must conform to the LogReceiptModel.
     *
     * @param {Response} res outgoing HTTP response values
     */
    logReceipt: function (req, res) {
        var log = this.log.child('logReceipt');
        log.BEGIN();

        var params = {
            sequenceId: req.param('sequenceId'),
            when: req.param('when')
        };

        log.info('params:', params);

        var errors = this.LogReceiptModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', errors);
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        this.postTracker.track(Number(params.sequenceId), new Date(params.when));
        res.send(HTTPStatus.NO_CONTENT); // OK but no content

        log.END();
    },

    /**
     * Deliver a generated notification to a specific service.
     *
     * @param {String} service the notification service tag
     *
     * @param {NotificationRequest} request description of the request to send
     */
    deliver: function (request) {
        this.senders[request.service].sendNotification(request);
    }
};
