'use strict';

/**
 * @fileOverview Defines the TemplateManager prototype and its methods.
 */
module.exports = TemplateManager;

var express = require('express');
var HTTPStatus = require('http-status');
var Model = require('model.js');

/**
 * TemplateManager constructor.
 *
 * @class
 *
 * A TemplateManager stores and retrieves notification template definitions. It relies on a TemplateStore object to
 * provide the actual storage.
 *
 * @param {TemplateStore} templateStore the TemplateStore instance to rely on for persistent data operations.
 */
function TemplateManager(templateStore) {
    this.log = require('./config').log('TemplateManager');
    this.templateStore = templateStore;

    /**
     * JSON schema for query to locate a specific template. Attributes:
     *
     * - eventId: the notification event identifier associated with the template
     * - route: the of the route associated with the template.
     * - templateVersion: the version of the template to locate
     * - templateLanguage: the language of the template to locate
     * - service: the OS-specific service that the template applies to
     */
    this.FindKeyModel = Model.extend(
        {
            eventId: {required:true, type:'integer'},
            route: {required:true, type:'string'},
            templateVersion: {required:true, type:'string', minlength:1, maxlength:10},
            templateLanguage: {required:true, type:'string', minlength:2, maxlength:10},
            service: {required:true, type:'string', minlength:1, maxlength:10}
        }
    );

    /**
     * JSON schema for a unique template key. Derives from {@link TemplateManager#FindKeyModel}. Attributes:
     *
     * - notificationId: the unique identifier associated with this template
     */
    this.TemplateKeyModel = this.FindKeyModel.extend(
        {
            notificationId: {required:true, type:'integer'}
        }
    );

    /**
     * JSON schema for template contents. Attributes:
     *
     * - content: the template content of the notification that will be sent to devices.
     */
    this.TemplateContentModel = Model.extend(
        {
            content: {required:true, type:'string'}
        }
    );

    /**
     * JSON schema for template definitions. Derived from the {@link TemplateManager#TemplateKeyModel}. Attributes:
     *
     * - template: the template content of the notification that will be sent to devices.
     */
    this.TemplateDefinitionModel = this.TemplateKeyModel.extend(
        {
            template: {required:true, type:'templateContent'}
        },
        {
            types:{
                templateContent:function (value) {
                    if (this.TemplateContentModel.validate(value) !== null) return null;
                    return value;
                }.bind(this)
            }
        }
    );
}

/**
 * TemplateManager prototype.
 *
 * Defines the methods available to a TemplateManager instance.
 */
TemplateManager.prototype = {

    /**
     * Add Express routes for the Registrar API.
     *
     * @param {Express.App} app the application to route
     */
    route: function(app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.get('/templates', this.get.bind(this));
        app.post('/templates', this.set.bind(this));
        app.del('/templates', this.del.bind(this));
        log.END();
    },

    /**
     * Get one or more existing templates that match a given key. The key is made up of the following parameters:
     *
     * - eventId: the notification event identifier associated with the template
     * - route: the of the route associated with the template.
     * - templateVersion: the version of the template to locate
     * - templateLanguage: the language of the template to locate
     * - service: the OS-specific service that the template applies to
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid query attribute(s)
     * - 500 INTERNAL SERVER ERROR: unable to process the request for some reason
     * - 404 NOT FOUND: no templates were found for the given key attributes
     * - 200 OK: one or more templates were found
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request. Any templates found will be returned in JSON output.
     *
     */
    get: function (req, res) {
        var log = this.log.child('get');
        log.BEGIN(req.query);

        var params = {
          eventId: req.param('eventId'),
          route: req.param('route'),
          templateVersion: req.param('templateVersion'),
          templateLanguage: req.param('templateLanguage'),
          service: req.param('service')
        };

        log.info('params:', params);

        var errors = this.FindKeyModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var reg = {
            'templateVersion': '' + params.templateVersion,
            'templateLanguage': params.templateLanguage,
            'service': params.service,
            'routes': [ {'name':params.route, 'token':''} ]
        };

        var start = Date.now();
        this.templateStore.find(params.eventId, [reg], function (err, templates) {
            var duration = Date.now() - start;
            if (err) {
                log.error('TemplateStore.find error:', err);
                res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
            }
            else if (templates.length === 0) {
                log.info('no templates found in store');
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                var tmp = {
                    'templates': templates,
                    'tableStoreDuration': duration
                };
                res.json(HTTPStatus.OK, tmp);
            }

            log.END(duration, 'msec');
        });
    },

    /**
     * Add or update a template with a given key. Expects the following parameters:
     *
     * - eventId: the notification event identifier associated with the template
     * - notificationId: the unique identifier associated with the template
     * - route: the of the route associated with the template.
     * - templateVersion: the version of the template to locate
     * - templateLanguage: the language of the template to locate
     * - service: the OS-specific service that the template applies to
     * - template: JSON object that defines the template payload
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid template attribute(s)
     * - 500 INTERNAL SERVER ERROR: unable to process the request for some reason
     * - 200 OK: one or moret templates were found
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request.
     */
    set: function (req, res) {
        var log = this.log.child('set');
        log.BEGIN();

        var params = {
            eventId: req.param('eventId'),
            notificationId: req.param('notificationId'),
            route: req.param('route'),
            templateVersion: req.param('templateVersion'),
            templateLanguage: req.param('templateLanguage'),
            service: req.param('service'),
            template: req.param('template')
        };

        log.info('params:', params);
        var errors = this.TemplateDefinitionModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        if (typeof params.template.content !== 'string') {
            params.template.content = JSON.stringify(params.template.content);
        }

        var start = Date.now();
        this.templateStore.add(params, function (err, templateEntity)
        {
            var duration = Date.now() - start;
            if (err) {
                log.error('TemplateStore.add error:', err);
                res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
            }
            else {
                var tmp = {
                    'tableStoreDuration': duration
                };
                res.json(HTTPStatus.OK, tmp);
            }

            log.END(duration, 'msec');
        });
    },

    /**
     * Delete a template from the template store. Expects the following parameters:
     *
     * - eventId: the notification event identifier associated with the template
     * - notificationId: the unique identifier associated with the template
     * - route: the of the route associated with the template.
     * - templateVersion: the version of the template to locate
     * - templateLanguage: the language of the template to locate
     * - service: the OS-specific service that the template applies to
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid template attribute(s)
     * - 404 NOT FOUND: unable to find the template to delete
     * - 204 NO CONTENT: found and deleted the template
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request.
     *
     */
    del: function (req, res) {
        var log = this.log.child('del');
        log.BEGIN();

        var params = {
            eventId: req.param('eventId'),
            notificationId: req.param('notificationId'),
            route: req.param('route'),
            templateVersion: req.param('templateVersion'),
            templateLanguage: req.param('templateLanguage'),
            service: req.param('service')
        };

        log.info('params:', params);

        var errors = this.TemplateKeyModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        this.templateStore.del(params, function (err, templateEntity) {
            var duration = Date.now() - start;
            if (err !== null) {
                log.error('TemplateStore.removeTemplate error:', err);
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                log.info('removed');
                res.send(HTTPStatus.NO_CONTENT);
            }
            log.END(duration, 'msecs');
        });
    }
};
