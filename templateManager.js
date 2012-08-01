'use strict';

/**
 * @fileOverview Defines the TemplateManager prototype and its methods.
 */
module.exports = TemplateManager;

var HTTPStatus = require('http-status');
var Model = require('model.js');

/**
 * Initializes a new TemplateManager object. A TemplateManager stores and retrieves notification template definitions.
 * It relies on a TemplateStore object to provide the actual storage.
 *
 * @class TemplateManager
 *
 * @param {TemplateStore} templateStore the TemplateStore instance to rely on
 */
function TemplateManager(templateStore) {
    this.log = require('./config').log('TemplateManager');
    this.templateStore = templateStore;

    this.FindKeyModel = Model.extend(
        {
            eventId: {required:true, type:'integer'},
            route: {required:true, type:'string'},
            templateVersion: {required:true, type:'string', minlength:1, maxlength:10},
            templateLanguage: {required:true, type:'string', minlength:2, maxlength:10},
            service: {required:true, type:'string', minlength:1, maxlength:10}
        }
    );

    this.TemplateKeyModel = this.FindKeyModel.extend(
        {
            notificationId: {required:true, type:'integer'}
        }
    );

    this.TemplateContentModel = Model.extend(
        {
            content: {required:true, type:'string'}
        }
    );

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

TemplateManager.prototype = {

    /**
     * Add a template to the store.
     */
    addTemplate: function (req, res) {
        var log = this.log.child('addTemplate');
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
            log.error('invalid params:', errors);
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        if (typeof params.template.content !== 'string') {
            params.template.content = JSON.stringify(params.template.content);
        }

        var start = Date.now();
        this.templateStore.addTemplate(params, function (err, templateEntity)
        {
            var duration = Date.now() - start;
            if (err) {
                log.error('TemplateStore.addTemplate error:', err);
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
     * Get a template.
     */
    getTemplates: function (req, res) {
        var log = this.log.child('getTemplates');
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
            log.error('invalid params:', errors);
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
        this.templateStore.findTemplates(params.eventId, [reg], function (err, templates)
        {
            var duration = Date.now() - start;
            if (err) {
                log.error('TemplateStore.findTemplates error:', err);
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
     * Delete a template.
     */
    deleteTemplate: function (req, res) {
        var log = this.log.child('deleteTemplate');
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
            log.error('invalid params:', errors);
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        this.templateStore.removeTemplate(params, function (err, templateEntity)
        {
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
